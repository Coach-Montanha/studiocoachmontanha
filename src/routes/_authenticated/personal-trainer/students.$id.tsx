import { createFileRoute, Link } from "@tanstack/react-router";
import { Fragment, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Pencil, Trash2, Wallet, Activity, Percent, Layers } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import { toast } from "sonner";
import { format, subMonths, startOfMonth } from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KPICard } from "@/components/edufinance/KPICard";
import { EmptyState } from "@/components/edufinance/EmptyState";
import { PaymentStatusBadge } from "@/components/edufinance/Badges";
import { PTBadge, PTSessionStatusBadge, PTStudentStatusBadge } from "@/components/pt/PTBadges";
import { PTStudentDialog } from "@/components/pt/PTStudentDialog";
import { PTSessionDialog } from "@/components/pt/PTSessionDialog";
import { PTPaymentDialog } from "@/components/pt/PTPaymentDialog";
import { BulkPTSessionsDialog } from "@/components/pt/BulkPTSessionsDialog";
import { formatBRL, formatDateBR, formatMonthLabel, initials, paymentMethodLabel } from "@/lib/format";
import { ContractsTab } from "@/components/edufinance/ContractsTab";

import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/personal-trainer/students/$id")({
  head: () => ({ meta: [{ title: "Aluno PT — EduFinance" }] }),
  component: PTStudentDetail,
});

function PTStudentDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [editStudent, setEditStudent] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<any>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<any>(null);
  const [bulkSessionsOpen, setBulkSessionsOpen] = useState(false);

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
    // Aulas no pacote atual: most recent package payment vs sessions linked to it
    const lastPkg = paidPayments.find((p) => p.pt_plans?.billing_type === "package");
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
    if (!confirm("Excluir aula?")) return;
    const { error } = await supabase.from("pt_sessions").delete().eq("id", sId);
    if (error) return toast.error(error.message);
    toast.success("Aula excluída");
    qc.invalidateQueries();
  }
  async function deletePayment(pId: string) {
    if (!confirm("Excluir pagamento?")) return;
    const { error } = await supabase.from("pt_payments").delete().eq("id", pId);
    if (error) return toast.error(error.message);
    toast.success("Pagamento excluído");
    qc.invalidateQueries();
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
        <Button variant="outline" onClick={() => setEditStudent(true)}><Pencil className="h-4 w-4" /> Editar</Button>
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
      <h2 className="mb-3 text-sm font-semibold">Aulas realizadas (últimos 12 meses)</h2>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
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

function SessionsTab({ sessions, onAdd, onBulkAdd, onEdit, onDelete }: {
  sessions: any[];
  onAdd: () => void;
  onBulkAdd: () => void;
  onEdit: (s: any) => void;
  onDelete: (id: string) => void;
}) {
  const currentMonth = format(new Date(), "yyyy-MM");
  const [monthFilter, setMonthFilter] = useState<string>(currentMonth);
  const [statusFilter, setStatusFilter] = useState<string>("all");

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

      {filtered.length === 0 ? (
        <EmptyState title="Sem aulas" description="Nenhuma aula para o filtro" />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Horário</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Observações</TableHead>
                <TableHead>Próxima aula</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="text-xs font-mono">{formatDateBR(s.session_date)}</TableCell>
                  <TableCell className="text-xs font-mono">{s.session_time?.slice(0, 5) ?? "—"}</TableCell>
                  <TableCell className="text-xs">{s.duration_minutes}min</TableCell>
                  <TableCell><PTSessionStatusBadge status={s.status} /></TableCell>
                  <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">{s.performance_notes ?? "—"}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">{s.next_session_plan ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => onEdit(s)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => onDelete(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/40 p-3 text-xs">
            <span><strong>{summary.done}</strong> realizadas</span>
            <span><strong>{summary.cancelled}</strong> canceladas</span>
            <span><strong>{summary.noshow}</strong> faltas</span>
            <span>Taxa: <strong>{summary.rate.toFixed(1).replace(".", ",")}%</strong></span>
          </div>
        </>
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
