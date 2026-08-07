import { chartTooltip } from "@/lib/chart-theme";
import { createFileRoute, Link } from "@tanstack/react-router";
import { confirmDialog } from "@/lib/confirm-dialog";
import { Fragment, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Pencil, Trash2, Wallet, Activity, Percent, Layers, RefreshCw, PauseCircle, ClipboardList } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import { toast } from "sonner";
import { format, subMonths, startOfMonth } from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { KPICard } from "@/components/edufinance/KPICard";
import { EmptyState } from "@/components/edufinance/EmptyState";
import { PaymentStatusBadge } from "@/components/edufinance/Badges";
import { PTBadge, PTSessionStatusBadge, PTStudentStatusBadge } from "@/components/pt/PTBadges";
import { PTStudentDialog } from "@/components/pt/PTStudentDialog";
import { PTSessionDialog } from "@/components/pt/PTSessionDialog";
import { PTPaymentDialog } from "@/components/pt/PTPaymentDialog";
import { BulkPTSessionsDialog } from "@/components/pt/BulkPTSessionsDialog";
import { FreezeDialog } from "@/components/edufinance/FreezeDialog";
import { formatBRL, formatDateBR, formatMonthLabel, initials, paymentMethodLabel } from "@/lib/format";
import { renewPtPayment } from "@/lib/payment-renew";
import { ContractsTab } from "@/components/edufinance/ContractsTab";
import { ProgramsTab } from "@/components/pt/ProgramsTab";


import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/personal-trainer/students/$id")({
  head: () => ({ meta: [{ title: "Aluno PT — EduFinance" }] }),
  component: PTStudentDetail,
});

function PTStudentDetail() {
  const { id } = Route.useParams();
  const navigate = Route.useNavigate();
  const qc = useQueryClient();
  const [editStudent, setEditStudent] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<any>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<any>(null);
  const [bulkSessionsOpen, setBulkSessionsOpen] = useState(false);
  const [freezeOpen, setFreezeOpen] = useState(false);

  const { data: student } = useQuery({
    queryKey: ["pt-student", id],
    queryFn: async () => (await supabase.from("pt_students").select("*").eq("id", id).single()).data,
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["pt-student-sessions", id],
    queryFn: async () =>
      (await supabase.from("pt_sessions").select("*").eq("pt_student_id", id).order("session_date", { ascending: false })).data ?? [],
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["pt-student-payments", id],
    queryFn: async () => {
      const { data: pays } = await supabase
        .from("pt_payments")
        .select("*,pt_plans(name,billing_type,sessions_per_month,package_sessions)")
        .eq("pt_student_id", id)
        .is("deleted_at", null)
        .order("payment_date", { ascending: false });

      if (!pays?.length) return [];

      const { data: sessions } = await supabase
        .from("pt_sessions")
        .select("id,pt_payment_id,status,session_date")
        .eq("pt_student_id", id)
        .eq("status", "completed")
        .not("pt_payment_id", "is", null);

      const sessionsByPayment = new Map<string, any[]>();
      for (const s of sessions ?? []) {
        if (!s.pt_payment_id) continue;
        const arr = sessionsByPayment.get(s.pt_payment_id) ?? [];
        arr.push(s);
        sessionsByPayment.set(s.pt_payment_id, arr);
      }

      return pays.map((p: any) => {
        const contracted =
          p.sessions_paid ??
          p.pt_plans?.sessions_per_month ??
          p.pt_plans?.package_sessions ??
          null;
        const linkedSessions = sessionsByPayment.get(p.id) ?? [];
        const used = linkedSessions.length;
        const remaining = contracted !== null ? contracted - used : null;
        return { ...p, contracted, used, remaining, linkedSessions };
      });
    },
  });


  const [completedPeriod, setCompletedPeriod] = useState<string>("all");

  const kpis = useMemo(() => {
    const paidPayments = payments.filter((p) => p.status === "paid");
    const ltv = paidPayments.reduce((s, p) => s + Number(p.amount), 0);
    const now = new Date();
    const ymNow = format(now, "yyyy-MM");
    const yNow = format(now, "yyyy");
    const filteredSessions = sessions.filter((s) => {
      if (s.status !== "completed") return false;
      if (completedPeriod === "all") return true;
      if (completedPeriod === "year") return s.session_date.startsWith(yNow);
      if (completedPeriod === "month") return s.session_date.startsWith(ymNow);
      return true;
    });
    const completed = filteredSessions.length;
    const totalCount = sessions.length || 1;
    const allCompleted = sessions.filter((s) => s.status === "completed").length;
    const rate = sessions.length ? (allCompleted / totalCount) * 100 : 0;
    // Aulas no pacote atual: uses balance recorded on the most recent payment
    // with sessions_paid > 0 (falls back to plan.package_sessions)
    const lastPkg = paidPayments.find(
      (p) => (p.sessions_paid ?? 0) > 0 || p.pt_plans?.billing_type === "package",
    );
    let pkgLabel: string = "—";
    let pkgFull = false;
    if (lastPkg) {
      const total = lastPkg.sessions_paid ?? lastPkg.pt_plans?.package_sessions ?? 0;
      const used = sessions.filter((s) => s.pt_payment_id === lastPkg.id && s.status === "completed").length;
      pkgLabel = `${used}/${total}`;
      pkgFull = total > 0 && used >= total;
    }
    return { ltv, completed, rate, pkgLabel, pkgFull };
  }, [payments, sessions, completedPeriod]);

  const currentPlan = payments.find((p) => p.status === "paid")?.pt_plans?.name;

  if (!student) return <div className="text-sm text-muted-foreground">Carregando…</div>;

  async function deleteSession(sId: string) {
    if (!(await confirmDialog("Excluir aula?"))) return;
    const { error } = await supabase.from("pt_sessions").delete().eq("id", sId);
    if (error) return toast.error(error.message);
    toast.success("Aula excluída");
    qc.invalidateQueries();
  }
  async function deletePayment(pId: string) {
    if (!(await confirmDialog("Excluir pagamento? Ele ficará disponível na Lixeira para restauração."))) return;
    const { error } = await supabase
      .from("pt_payments")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", pId);
    if (error) return toast.error(error.message);
    toast.success("Pagamento movido para a lixeira");
    qc.invalidateQueries();
  }

  async function deleteStudent(sId: string) {
    if (!(await confirmDialog("Excluir este aluno PT? Todos os dados (treinos, pagamentos) serão movidos para a Lixeira."))) return;
    const { error } = await supabase
      .from("pt_students")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", sId);
    if (error) return toast.error(error.message);
    toast.success("Aluno PT movido para a Lixeira");
    qc.invalidateQueries();
    navigate({ to: "/personal-trainer" });
  }

  return (
    <div className="space-y-6">
      <Link to="/personal-trainer" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
            {initials(student.name)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{student.name}</h1>
              <PTBadge />
            </div>
            <div className="mt-1 flex items-center gap-2">
              <PTStudentStatusBadge status={student.status} />
              {currentPlan && <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{currentPlan}</span>}
            </div>
            {student.goal && <div className="mt-1 text-xs text-muted-foreground">🎯 {student.goal}</div>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setEditStudent(true)}><Pencil className="h-4 w-4" /> Editar</Button>
          <Button variant="outline" onClick={() => setFreezeOpen(true)}><PauseCircle className="h-4 w-4" /> Congelar Aluno</Button>
          <Button
            variant="outline"
            className="text-destructive hover:bg-destructive/10 transition-all duration-200 active:scale-[0.98]"
            onClick={() => deleteStudent(id)}
          >
            <Trash2 className="h-4 w-4" /> Excluir Aluno
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard label="Total Pago (LTV)" value={formatBRL(kpis.ltv)} icon={<Wallet className="h-5 w-5" />} />
        <Card className="p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-medium text-muted-foreground">Aulas Realizadas</div>
            <Activity className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono">{kpis.completed}</div>
          <Select value={completedPeriod} onValueChange={setCompletedPeriod}>
            <SelectTrigger className="mt-2 h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Total (todo o histórico)</SelectItem>
              <SelectItem value="year">Ano atual</SelectItem>
              <SelectItem value="month">Mês atual</SelectItem>
            </SelectContent>
          </Select>
        </Card>
        <KPICard label="Taxa de Presença" value={`${kpis.rate.toFixed(1).replace(".", ",")}%`} icon={<Percent className="h-5 w-5" />} />
        <KPICard
          label="Aulas no Pacote Atual"
          value={kpis.pkgLabel}
          hint={kpis.pkgFull ? "Pacote esgotado" : "Realizadas / Contratadas"}
          icon={<Layers className="h-5 w-5" />}
        />
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Resumo</TabsTrigger>
          <TabsTrigger value="sessions">Aulas</TabsTrigger>
          <TabsTrigger value="payments">Pagamentos</TabsTrigger>
          <TabsTrigger value="programs">Treinos</TabsTrigger>
          <TabsTrigger value="contracts">Contratos</TabsTrigger>
        </TabsList>


        <TabsContent value="overview" className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold">Informações do aluno</h2>
            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              <InfoRow label="Email" value={student.email} />
              <InfoRow label="Telefone" value={student.phone} />
              <InfoRow label="Data de nascimento" value={student.birth_date ? formatDateBR(student.birth_date) : null} />
              <InfoRow label="Data de início" value={student.start_date ? formatDateBR(student.start_date) : null} />
              <div className="sm:col-span-2"><InfoRow label="Objetivo" value={student.goal} /></div>
              <div className="sm:col-span-2"><InfoRow label="Observações de saúde" value={student.health_notes} /></div>
            </div>
          </Card>

          <SessionsBarChart sessions={sessions} />
          <AttendanceHeatmap sessions={sessions} payments={payments} />
        </TabsContent>

        <TabsContent value="sessions">
          <SessionsTab
            sessions={sessions}
            payments={payments}
            onAdd={() => { setEditingSession(null); setSessionOpen(true); }}
            onBulkAdd={() => setBulkSessionsOpen(true)}
            onEdit={(s) => { setEditingSession(s); setSessionOpen(true); }}
            onDelete={deleteSession}
          />
        </TabsContent>

        <TabsContent value="payments">
          <PaymentsTab
            payments={payments}
            onAdd={() => { setEditingPayment(null); setPaymentOpen(true); }}
            onEdit={(p) => { setEditingPayment(p); setPaymentOpen(true); }}
            onDelete={deletePayment}
          />
        </TabsContent>

        <TabsContent value="programs">
          <ProgramsTab studentId={id} />
        </TabsContent>


        <TabsContent value="contracts">
          <ContractsTab
            studentId={id}
            tableName="pt_student_contracts"
            foreignKey="pt_student_id"
          />
        </TabsContent>
      </Tabs>


      <PTStudentDialog open={editStudent} onOpenChange={setEditStudent} student={student} />
      <PTSessionDialog open={sessionOpen} onOpenChange={setSessionOpen} defaultStudentId={id} session={editingSession} />
      <PTPaymentDialog open={paymentOpen} onOpenChange={setPaymentOpen} defaultStudentId={id} payment={editingPayment} />
      <BulkPTSessionsDialog open={bulkSessionsOpen} onOpenChange={setBulkSessionsOpen} studentId={id} />
      <FreezeDialog
        open={freezeOpen}
        onOpenChange={setFreezeOpen}
        studentId={id}
        planName={currentPlan}
      />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value || "—"}</div>
    </div>
  );
}

function SessionsBarChart({ sessions }: { sessions: any[] }) {
  const data = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 11; i >= 0; i--) {
      const k = format(startOfMonth(subMonths(new Date(), i)), "yyyy-MM");
      map.set(k, 0);
    }
    for (const s of sessions) {
      if (s.status !== "completed") continue;
      const k = s.session_date.slice(0, 7);
      if (map.has(k)) map.set(k, (map.get(k) ?? 0) + 1);
    }
    return [...map.entries()].map(([k, v]) => ({ month: formatMonthLabel(k), value: v }));
  }, [sessions]);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">Aulas realizadas (últimos 12 meses)</h2>
        <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
          <Activity className="h-3 w-3" /> Monitoramento de Performance
        </div>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
            <Tooltip {...chartTooltip} />
            <Bar dataKey="value" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function AttendanceHeatmap({ sessions, payments }: { sessions: any[]; payments: any[] }) {
  const months = useMemo(() => {
    const arr: { key: string; label: string }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      arr.push({ key: format(d, "yyyy-MM"), label: formatMonthLabel(format(d, "yyyy-MM")) });
    }
    return arr;
  }, []);

  function cellFor(monthKey: string) {
    const done = sessions.filter((s) => s.session_date.startsWith(monthKey) && s.status === "completed").length;
    // contracted = sessions_per_month from a payment that month
    const monthPayment = payments.find((p) => p.reference_month === monthKey && p.status === "paid");
    const contracted = monthPayment?.pt_plans?.sessions_per_month ?? monthPayment?.sessions_paid ?? null;
    let color = "bg-muted/40 text-muted-foreground";
    if (contracted) {
      const ratio = done / contracted;
      if (ratio >= 1) color = "bg-success/15 text-success";
      else if (ratio >= 0.5) color = "bg-warning/15 text-warning-foreground";
      else color = "bg-destructive/10 text-destructive";
    } else if (done > 0) {
      color = "bg-success/15 text-success";
    }
    return { done, contracted, color };
  }

  return (
    <Card className="p-5">
      <h2 className="mb-3 text-sm font-semibold">Frequência mensal</h2>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-12">
        {months.map((m) => {
          const c = cellFor(m.key);
          return (
            <div key={m.key} className={cn("flex h-20 flex-col items-center justify-center rounded-lg border text-xs", c.color)}>
              <span className="text-[10px] uppercase">{m.label}</span>
              <span className="mt-1 font-semibold">{c.done}{c.contracted ? `/${c.contracted}` : ""}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function SessionsTab({ sessions, payments, onAdd, onBulkAdd, onEdit, onDelete }: {
  sessions: any[];
  payments: any[];
  onAdd: () => void;
  onBulkAdd: () => void;
  onEdit: (s: any) => void;
  onDelete: (id: string) => void;
}) {
  const qc = useQueryClient();
  const currentMonth = format(new Date(), "yyyy-MM");
  const [monthFilter, setMonthFilter] = useState<string>(currentMonth);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPaymentId, setBulkPaymentId] = useState<string>("");
  const [linking, setLinking] = useState(false);

  const months = useMemo(() => {
    const s = new Set(sessions.map((x) => x.session_date.slice(0, 7)));
    return [...s].sort().reverse();
  }, [sessions]);

  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      if (monthFilter !== "all" && !s.session_date.startsWith(monthFilter)) return false;
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      return true;
    });
  }, [sessions, monthFilter, statusFilter]);

  const summary = useMemo(() => {
    const done = filtered.filter((s) => s.status === "completed").length;
    const cancelled = filtered.filter((s) => s.status === "cancelled_student" || s.status === "cancelled_trainer").length;
    const noshow = filtered.filter((s) => s.status === "no_show").length;
    const total = filtered.length;
    const rate = total ? (done / total) * 100 : 0;
    return { done, cancelled, noshow, rate };
  }, [filtered]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    if (filtered.every((s) => selected.has(s.id)) && filtered.length > 0) {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((s) => next.delete(s.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((s) => next.add(s.id));
        return next;
      });
    }
  }

  async function applyBulkLink(paymentId: string | null) {
    if (selected.size === 0) return;
    setLinking(true);
    const { error } = await supabase
      .from("pt_sessions")
      .update({ pt_payment_id: paymentId })
      .in("id", [...selected]);
    setLinking(false);
    if (error) return toast.error(error.message);
    toast.success(
      paymentId
        ? `${selected.size} aula(s) vinculada(s) ao pagamento`
        : `${selected.size} aula(s) desvinculada(s)`,
    );
    setSelected(new Set());
    setBulkPaymentId("");
    qc.invalidateQueries();
  }

  async function bulkDelete() {
    if (selected.size === 0) return;
    const ids = [...selected];
    if (!(await confirmDialog(`Excluir ${ids.length} aula(s) selecionada(s)?`))) return;
    setLinking(true);
    const { error } = await supabase.from("pt_sessions").delete().in("id", ids);
    setLinking(false);
    if (error) return toast.error(error.message);
    toast.success(`${ids.length} aula(s) excluída(s)`);
    setSelected(new Set());
    qc.invalidateQueries();
  }

  const paymentLabel = (p: any) => {
    const dateLabel = p.payment_date
      ? new Date(p.payment_date + "T12:00").toLocaleDateString("pt-BR")
      : "—";
    const planLabel = p.pt_plans?.name ? ` · ${p.pt_plans.name}` : "";
    const balance =
      p.contracted !== null && p.contracted !== undefined
        ? ` · ${p.used ?? 0}/${p.contracted}`
        : "";
    return `${dateLabel}${planLabel} · ${formatBRL(Number(p.amount))}${balance}`;
  };

  const paymentById = new Map(payments.map((p) => [p.id, p]));
  const allChecked = filtered.length > 0 && filtered.every((s) => selected.has(s.id));

  return (
    <Card className="p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os meses</SelectItem>
              {months.map((m) => <SelectItem key={m} value={m}>{formatMonthLabel(m)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="completed">Realizada</SelectItem>
              <SelectItem value="cancelled_student">Cancelada (aluno)</SelectItem>
              <SelectItem value="cancelled_trainer">Cancelada (professor)</SelectItem>
              <SelectItem value="no_show">Falta</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBulkAdd}><Plus className="h-4 w-4" /> Registrar em lote</Button>
          <Button onClick={onAdd}><Plus className="h-4 w-4" /> Registrar Nova Aula</Button>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <div className="text-xs font-medium">
            <strong>{selected.size}</strong> aula(s) selecionada(s)
          </div>
          <div className="ml-auto flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Vincular ao pagamento/plano</Label>
              <Select value={bulkPaymentId} onValueChange={setBulkPaymentId}>
                <SelectTrigger className="w-[340px]"><SelectValue placeholder="Selecione um pagamento" /></SelectTrigger>
                <SelectContent>
                  {payments.length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum pagamento cadastrado</div>
                  )}
                  {payments.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{paymentLabel(p)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              onClick={() => applyBulkLink(bulkPaymentId || null)}
              disabled={linking || !bulkPaymentId}
            >
              Vincular
            </Button>
            <Button size="sm" variant="outline" onClick={() => applyBulkLink(null)} disabled={linking}>
              Desvincular
            </Button>
            <Button size="sm" variant="destructive" onClick={bulkDelete} disabled={linking}>
              <Trash2 className="h-4 w-4" /> Excluir
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Cancelar</Button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState title="Sem aulas" description="Nenhuma aula para o filtro" />
      ) : (
        <Fragment>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label="Selecionar todas" />
                </TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Horário</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Plano/Pagamento</TableHead>
                <TableHead>Observações</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => {
                const linked = s.pt_payment_id ? paymentById.get(s.pt_payment_id) : null;
                return (
                  <TableRow key={s.id} data-state={selected.has(s.id) ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(s.id)}
                        onCheckedChange={() => toggle(s.id)}
                        aria-label="Selecionar aula"
                      />
                    </TableCell>
                    <TableCell className="text-xs font-mono">{formatDateBR(s.session_date)}</TableCell>
                    <TableCell className="text-xs font-mono">{s.session_time?.slice(0, 5) ?? "—"}</TableCell>
                    <TableCell className="text-xs">{s.duration_minutes}min</TableCell>
                    <TableCell><PTSessionStatusBadge status={s.status} /></TableCell>
                    <TableCell className="max-w-[220px] truncate text-xs">
                      {linked ? (
                        <span className="text-foreground">
                          {linked.pt_plans?.name ?? "Pagamento"}
                          <span className="ml-1 text-muted-foreground">
                            · {linked.payment_date ? new Date(linked.payment_date + "T12:00").toLocaleDateString("pt-BR") : ""}
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Avulsa</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">{s.performance_notes ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => onEdit(s)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => onDelete(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          
          <div className="space-y-4">
            <div className="rounded-xl border bg-muted/30 p-4">
              <h4 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <ClipboardList className="h-3.5 w-3.5" /> Últimos Feedbacks e Resultados
              </h4>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filtered
                  .filter(s => s.status === 'completed' && (s.performance_notes || s.exercises))
                  .slice(0, 6)
                  .map(s => (
                    <div key={s.id} className="group relative rounded-lg border bg-card p-3 shadow-sm transition-all hover:border-primary/30">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-primary tabular-nums">
                          {formatDateBR(s.session_date)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {s.duration_minutes}min
                        </span>
                      </div>
                      {s.performance_notes && (
                        <div className="mb-2">
                          <p className="text-xs font-semibold text-foreground/80">Feedback:</p>
                          <p className="text-xs text-muted-foreground line-clamp-2">{s.performance_notes}</p>
                        </div>
                      )}
                      {s.exercises && (
                        <div>
                          <p className="text-xs font-semibold text-foreground/80">Exercícios/Cargas:</p>
                          <p className="text-xs text-muted-foreground line-clamp-2 italic">{s.exercises}</p>
                        </div>
                      )}
                    </div>
                  ))}
                {filtered.filter(s => s.status === 'completed' && (s.performance_notes || s.exercises)).length === 0 && (
                  <p className="col-span-full py-4 text-center text-xs text-muted-foreground italic">
                    Nenhum relatório detalhado encontrado para este período.
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/40 p-3 text-xs">
              <span><strong>{summary.done}</strong> realizadas</span>
              <span><strong>{summary.cancelled}</strong> canceladas</span>
              <span><strong>{summary.noshow}</strong> faltas</span>
              <span>Taxa: <strong>{summary.rate.toFixed(1).replace(".", ",")}%</strong></span>
            </div>
          </div>
        </Fragment>
      )}
    </Card>
  );
}

function PaymentsTab({ payments, onAdd, onEdit, onDelete }: {
  payments: any[];
  onAdd: () => void;
  onEdit: (p: any) => void;
  onDelete: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [renewingId, setRenewingId] = useState<string | null>(null);

  async function handleRenew(p: any) {
    if (renewingId) return;
    setRenewingId(p.id);
    const ok = await renewPtPayment({
      id: p.id,
      pt_student_id: p.pt_student_id,
      pt_plan_id: p.pt_plan_id,
      amount: p.amount,
      payment_date: p.payment_date,
      reference_month: p.reference_month,
      payment_method: p.payment_method,
      notes: p.notes,
      sessions_paid: p.sessions_paid,
    });
    setRenewingId(null);
    if (ok) qc.invalidateQueries();
  }

  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const p of payments) {
      const y = (p.reference_month?.slice(0, 4) ?? p.payment_date.slice(0, 4));
      if (!map.has(y)) map.set(y, []);
      map.get(y)!.push(p);
    }
    return [...map.entries()].sort(([a], [b]) => (a < b ? 1 : -1));
  }, [payments]);

  return (
    <Card className="p-5 space-y-4">
      <div className="flex justify-end">
        <Button onClick={onAdd}><Plus className="h-4 w-4" /> Registrar Pagamento</Button>
      </div>
      {grouped.length === 0 ? (
        <EmptyState title="Sem pagamentos" description="Nenhum pagamento registrado" />
      ) : grouped.map(([year, rows]) => {
        const paid = rows.filter((r) => r.status === "paid");
        const total = paid.reduce((s, r) => s + Number(r.amount), 0);
        return (
          <div key={year} className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">{year}</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Referência</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Aulas</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead>Forma</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => (
                  <Fragment key={p.id}>
                    <TableRow>
                      <TableCell className="text-xs font-mono">{formatDateBR(p.payment_date)}</TableCell>
                      <TableCell className="text-xs">{p.reference_month ? formatMonthLabel(p.reference_month) : "—"}</TableCell>
                      <TableCell className="text-xs">{p.pt_plans?.name ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono">{formatBRL(p.amount)}</TableCell>
                      <TableCell className="text-right font-mono">{p.sessions_paid ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {p.contracted != null ? (
                          <span className={cn(p.remaining !== null && p.remaining < 0 && "text-destructive font-semibold")}>
                            {p.used}/{p.contracted}
                            {p.remaining !== null && (
                              <span className="ml-1 text-muted-foreground">
                                ({p.remaining >= 0 ? `${p.remaining} rest.` : `${Math.abs(p.remaining)} exc.`})
                              </span>
                            )}
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-xs">{paymentMethodLabel(p.payment_method)}</TableCell>
                      <TableCell><PaymentStatusBadge status={p.status} /></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Renovar pagamento"
                            onClick={() => handleRenew(p)}
                            disabled={renewingId === p.id}
                          >
                            <RefreshCw className={cn("h-4 w-4 text-primary", renewingId === p.id && "animate-spin")} />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => onEdit(p)}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => onDelete(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {p.linkedSessions?.length > 0 && (
                      <TableRow className="bg-muted/20">
                        <TableCell colSpan={9} className="py-2">
                          <div className="text-xs text-muted-foreground">
                            <span className="font-semibold">Sessões vinculadas:</span>{" "}
                            {p.linkedSessions
                              .sort((a: any, b: any) => (a.session_date < b.session_date ? -1 : 1))
                              .map((s: any, i: number) => (
                                <span key={s.id}>
                                  {i > 0 ? " · " : ""}
                                  {new Date(s.session_date + "T12:00").toLocaleDateString("pt-BR")}
                                </span>
                              ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>

                ))}
                <TableRow className="bg-muted/40 font-medium">
                  <TableCell colSpan={3} className="text-xs">Total {year}</TableCell>
                  <TableCell className="text-right font-mono">{formatBRL(total)}</TableCell>
                  <TableCell colSpan={5} />
                </TableRow>
              </TableBody>
            </Table>

          </div>
        );
      })}
    </Card>
  );
}
