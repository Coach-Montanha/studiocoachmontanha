import { chartTooltip } from "@/lib/chart-theme";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Plus, CalendarDays, Wallet, Receipt, TrendingUp,
  Clock, Layers, Pencil, Trash2, PauseCircle, RefreshCw, ArrowRightLeft,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from "recharts";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Tooltip as TooltipRoot, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { KPICard } from "@/components/edufinance/KPICard";
import { PaymentStatusBadge, PlanBadge, StudentStatusBadge } from "@/components/edufinance/Badges";
import { EmptyState } from "@/components/edufinance/EmptyState";
import { PaymentDialog } from "@/components/edufinance/PaymentDialog";
import { FreezeDialog } from "@/components/edufinance/FreezeDialog";
import { TransferPaymentDialog } from "@/components/edufinance/TransferPaymentDialog";
import { renewPayment } from "@/lib/payment-renew";
import { confirmDialog } from "@/lib/confirm-dialog";
import {
  formatBRL, formatDateBR, formatMonthLabel, formatMonthLong,
  initials, paymentMethodLabel, monthKey,
} from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/students/$id")({
  head: () => ({ meta: [{ title: "Aluno — EduFinance" }] }),
  component: StudentDetail,
});

type PaymentRow = {
  id: string;
  amount: number;
  payment_date: string;
  reference_month: string;
  payment_method: string;
  status: string;
  notes: string | null;
  plan_id: string | null;
  student_id: string;
  auto_renew: boolean | null;
  renewed_from_payment_id: string | null;
  renewals_remaining: number | null;
  checkin_quota_override: number | null;
  plans: {
    name: string;
    billing_cycle: string | null;
    auto_renew: boolean | null;
    max_renewals: number | null;
    checkin_quota_type: string | null;
    checkin_quota_amount: number | null;
    package_valid_days: number | null;
  } | null;

};

function StudentDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<PaymentRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PaymentRow | null>(null);
  const [freezeOpen, setFreezeOpen] = useState(false);
  const [editingFreeze, setEditingFreeze] = useState<any | null>(null);
  const [transferPaymentId, setTransferPaymentId] = useState<string | null>(null);
  const [renewingId, setRenewingId] = useState<string | null>(null);

  const { data: student } = useQuery({
    queryKey: ["student", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id,name,email,phone,status,notes,created_at,attendance_offset,student_plan_history(id,plan_id,start_date,end_date,is_current,plans(name,price,max_freeze_days))")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: payments = [] } = useQuery<PaymentRow[]>({
    queryKey: ["student-payments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("id,student_id,amount,payment_date,reference_month,payment_method,status,notes,plan_id,auto_renew,renewed_from_payment_id,renewals_remaining,checkin_quota_override,plans(name,billing_cycle,auto_renew,max_renewals,checkin_quota_type,checkin_quota_amount,package_valid_days)")
        .eq("student_id", id)
        .is("deleted_at", null)
        .order("payment_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PaymentRow[];
    },
  });

  const { data: freezes = [] } = useQuery({
    queryKey: ["student-freezes", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_freezes")
        .select("id,payment_id,freeze_days,start_date,end_date,notes,created_at")
        .eq("student_id", id)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const [attendancePeriod, setAttendancePeriod] = useState<string>("all");

  const { data: attendance = [] } = useQuery({
    queryKey: ["student-attendance", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("class_attendance")
        .select("id, class_sessions:session_id (session_date)")
        .eq("student_id", id);
      return (data ?? []).map((r: any) => r.class_sessions?.session_date).filter(Boolean) as string[];
    },
  });

  const attendanceCount = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const y = String(now.getFullYear());
    const base = attendance.filter((d) => {
      if (attendancePeriod === "all") return true;
      if (attendancePeriod === "year") return d.startsWith(y);
      if (attendancePeriod === "month") return d.startsWith(ym);
      return true;
    }).length;
    // Offset (histórico anterior) só conta no total
    const offset = attendancePeriod === "all" ? Number((student as any)?.attendance_offset ?? 0) : 0;
    return base + offset;
  }, [attendance, attendancePeriod, student]);

  const paid = useMemo(() => payments.filter((p) => p.status === "paid"), [payments]);

  const kpis = useMemo(() => {
    const total = paid.reduce((s, p) => s + Number(p.amount), 0);
    const monthsSet = new Set(paid.map((p) => p.reference_month));
    const months = monthsSet.size;
    const avg = months ? total / months : 0;
    const sortedAsc = [...paid].sort((a, b) =>
      a.payment_date < b.payment_date ? -1 : 1,
    );
    const first = sortedAsc[0]?.reference_month;
    const last = sortedAsc[sortedAsc.length - 1]?.reference_month;
    const lastDate = sortedAsc[sortedAsc.length - 1]?.payment_date;
    let gapMonths = 0;
    if (first && last) {
      const [fy, fm] = first.split("-").map(Number);
      const [ly, lm] = last.split("-").map(Number);
      const totalMonths = (ly - fy) * 12 + (lm - fm) + 1;
      gapMonths = Math.max(0, totalMonths - months);
    }
    return { total, months, avg, lastDate, gapMonths };
  }, [paid]);

  const monthlySeries = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of paid) {
      map.set(p.reference_month, (map.get(p.reference_month) ?? 0) + Number(p.amount));
    }
    return [...map.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, v]) => ({ month: formatMonthLabel(k), value: v }));
  }, [paid]);

  if (!student) {
    return <div className="text-sm text-muted-foreground">Carregando…</div>;
  }

  const currentPlan = student.student_plan_history?.find((h) => h.is_current);

  async function handleDelete() {
    if (!deleteTarget) return;
    const { error } = await supabase
      .from("payments")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", deleteTarget.id)
      .is("deleted_at", null);
    if (error) return toast.error(error.message);
    toast.success("Pagamento movido para a Lixeira");
    qc.invalidateQueries();
    setDeleteTarget(null);
  }


  return (
    <TooltipProvider delayDuration={200}>
    <div className="space-y-6">
      <Link to="/students" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
            {initials(student.name)}
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{student.name}</h1>
            <div className="mt-1 flex items-center gap-2">
              <StudentStatusBadge status={student.status} />
              <PlanBadge name={currentPlan?.plans?.name} />
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {student.email ?? "Sem email"} · {student.phone ?? "Sem telefone"}
            </div>
            {student.notes && (
              <p className="mt-2 max-w-md text-xs text-muted-foreground">{student.notes}</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {currentPlan?.plans?.max_freeze_days ? (
            <Button
              variant="outline"
              onClick={() => { setEditingFreeze(null); setFreezeOpen(true); }}
            >
              <PauseCircle className="h-4 w-4" /> Trancar plano
            </Button>
          ) : null}
          <Button onClick={() => { setEditingPayment(null); setPaymentOpen(true); }}>
            <Plus className="h-4 w-4" /> Novo pagamento
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="payments">Histórico de Pagamentos</TabsTrigger>
          <TabsTrigger value="attendance">Análise de Frequência</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <KPICard label="💰 LTV Total" value={formatBRL(kpis.total)} icon={<Wallet className="h-5 w-5" />} />
            <KPICard label="📅 Meses Ativo" value={kpis.months} icon={<CalendarDays className="h-5 w-5" />} />
            <KPICard label="📊 Ticket Médio" value={formatBRL(kpis.avg)} icon={<TrendingUp className="h-5 w-5" />} />
            <KPICard label="🗓️ Último Pagamento" value={kpis.lastDate ? formatDateBR(kpis.lastDate) : "—"} icon={<Receipt className="h-5 w-5" />} />
            <KPICard label="⏳ Meses sem pagamento" value={kpis.gapMonths} icon={<Clock className="h-5 w-5" />} />
            <KPICard
              label="🔁 Plano Atual"
              value={currentPlan?.plans?.name ?? "—"}
              hint={currentPlan?.plans?.price ? formatBRL(Number(currentPlan.plans.price)) : undefined}
              icon={<Layers className="h-5 w-5" />}
            />
            <Card className="p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium text-muted-foreground">🏃 Aulas realizadas</div>
              </div>
              <div className="mt-2 text-2xl font-bold font-mono">{attendanceCount}</div>
              <Select value={attendancePeriod} onValueChange={setAttendancePeriod}>
                <SelectTrigger className="mt-2 h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Total (todo o histórico)</SelectItem>
                  <SelectItem value="year">Ano atual</SelectItem>
                  <SelectItem value="month">Mês atual</SelectItem>
                </SelectContent>
              </Select>
            </Card>
          </div>

          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold">Evolução de pagamentos</h2>
            {monthlySeries.length === 0 ? (
              <EmptyState title="Sem dados" description="Sem pagamentos registrados" />
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlySeries}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatBRL(v)} width={90} />
                    <Tooltip {...chartTooltip} formatter={(v: number) => formatBRL(v)} />
                    <Line type="monotone" dataKey="value" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold">Histórico de planos</h2>
            {(student.student_plan_history ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum plano associado</p>
            ) : (
              <ul className="space-y-2">
                {student.student_plan_history?.map((h) => (
                  <li key={h.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                    <div>
                      <PlanBadge name={h.plans?.name} />
                      <span className="ml-2 text-xs text-muted-foreground">
                        Início: {formatDateBR(h.start_date)} · Fim: {h.end_date ? formatDateBR(h.end_date) : "atual"}
                      </span>
                    </div>
                    {h.is_current && <span className="text-xs font-medium text-success">Atual</span>}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Trancamentos</h2>
              {currentPlan?.plans?.max_freeze_days ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setEditingFreeze(null); setFreezeOpen(true); }}
                >
                  <PauseCircle className="h-4 w-4" /> Novo trancamento
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Plano atual não permite trancamento.
                </span>
              )}
            </div>
            {freezes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum trancamento registrado.</p>
            ) : (
              <ul className="space-y-2">
                {freezes.map((f: any) => (
                  <li key={f.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium">
                        {f.freeze_days} dia(s) — {formatDateBR(f.start_date)} até {formatDateBR(f.end_date)}
                      </div>
                      {f.notes && (
                        <div className="mt-1 text-xs text-muted-foreground">{f.notes}</div>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => { setEditingFreeze(f); setFreezeOpen(true); }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={async () => {
                          if (!(await confirmDialog("Excluir este trancamento?"))) return;
                          const { error } = await supabase.from("payment_freezes").delete().eq("id", f.id);
                          if (error) return toast.error(error.message);
                          toast.success("Trancamento excluído");
                          qc.invalidateQueries();
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <PaymentsTab
            payments={payments}
            attendanceDates={attendance}
            freezes={freezes as any[]}

            onEdit={(p) => { setEditingPayment(p); setPaymentOpen(true); }}
            onDelete={(p) => setDeleteTarget(p)}
            onAdd={() => { setEditingPayment(null); setPaymentOpen(true); }}
            onTransfer={(p) => setTransferPaymentId(p.id)}
            onRenew={async (p) => {
              setRenewingId(p.id);
              const ok = await renewPayment(p);
              setRenewingId(null);
              if (ok) qc.invalidateQueries();
            }}
            onToggleAutoRenew={async (p) => {
              const next = !(p.auto_renew ?? p.plans?.auto_renew ?? false);
              const { error } = await supabase
                .from("payments")
                .update({ auto_renew: next })
                .eq("id", p.id);
              if (error) { toast.error(error.message); return; }
              toast.success(next ? "Renovação automática ativada" : "Renovação automática desativada");
              qc.invalidateQueries();
            }}
            renewingId={renewingId}
          />
        </TabsContent>

        <TabsContent value="attendance">
          <AttendanceTab payments={payments} studentCreatedAt={student.created_at} />
        </TabsContent>
      </Tabs>

      <FreezeDialog
        open={freezeOpen}
        onOpenChange={setFreezeOpen}
        studentId={id}
        paymentId={paid[0]?.id ?? null}
        maxDays={currentPlan?.plans?.max_freeze_days ?? null}
        planName={currentPlan?.plans?.name ?? null}
        freeze={editingFreeze ?? undefined}
      />

      <PaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        defaultStudentId={id}
        payment={editingPayment ?? undefined}
      />

      <TransferPaymentDialog
        open={!!transferPaymentId}
        onOpenChange={(o) => !o && setTransferPaymentId(null)}
        paymentId={transferPaymentId}
        fromStudentId={id}
        fromStudentName={student.name}
        payment={payments.find((p) => p.id === transferPaymentId) ?? null}
      />


      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pagamento?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </TooltipProvider>
  );
}

/* ----------------------------- Payments Tab ----------------------------- */

function PaymentsTab({
  payments, attendanceDates, freezes, onEdit, onDelete, onAdd, onTransfer, onRenew, onToggleAutoRenew, renewingId,
}: {
  payments: PaymentRow[];
  attendanceDates: string[];
  freezes: any[];
  onEdit: (p: PaymentRow) => void;
  onDelete: (p: PaymentRow) => void;
  onAdd: () => void;
  onTransfer: (p: PaymentRow) => void;
  onRenew: (p: PaymentRow) => void | Promise<void>;
  onToggleAutoRenew: (p: PaymentRow) => void | Promise<void>;
  renewingId: string | null;
}) {
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const checkinByPayment = useMemo(
    () => allocateCheckins(payments, attendanceDates, freezes),
    [payments, attendanceDates, freezes],
  );


  const years = useMemo(() => {
    const s = new Set(payments.map((p) => p.reference_month.slice(0, 4)));
    return [...s].sort((a, b) => (a < b ? 1 : -1));
  }, [payments]);

  const filtered = useMemo(() => {
    return payments.filter((p) => {
      if (yearFilter !== "all" && !p.reference_month.startsWith(yearFilter)) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      return true;
    });
  }, [payments, yearFilter, statusFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, PaymentRow[]>();
    for (const p of filtered) {
      const y = p.reference_month.slice(0, 4);
      if (!map.has(y)) map.set(y, []);
      map.get(y)!.push(p);
    }
    return [...map.entries()].sort(([a], [b]) => (a < b ? 1 : -1));
  }, [filtered]);

  return (
    <Card className="p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Ano" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os anos</SelectItem>
              {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="paid">Pago</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="overdue">Atrasado</SelectItem>
              <SelectItem value="cancelled">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={onAdd}><Plus className="h-4 w-4" /> Adicionar Pagamento</Button>
      </div>

      {grouped.length === 0 ? (
        <EmptyState title="Sem pagamentos" description="Nenhum registro para os filtros selecionados" />
      ) : (
        grouped.map(([year, rows]) => {
          const paidRows = rows.filter((r) => r.status === "paid");
          const total = paidRows.reduce((s, r) => s + Number(r.amount), 0);
          const avg = paidRows.length ? total / paidRows.length : 0;
          return (
            <div key={year} className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground">{year}</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês de Referência</TableHead>
                    <TableHead>Data de Pagamento</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Forma</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Observações</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((p) => {
                    const isRenewable = p.auto_renew ?? p.plans?.auto_renew ?? false;
                    const remaining = p.renewals_remaining;
                    const isRenewing = renewingId === p.id;
                    const canRenew = p.status === "paid" && !isRenewing;
                    const pkg = checkinByPayment.get(p.id);
                    return (
                    <Fragment key={p.id}>
                    <TableRow className={cn("group transition-colors duration-200", pkg && "border-b-0")}>
                      <TableCell className="text-xs capitalize">
                        <span className="font-medium">{formatMonthLong(p.reference_month)}</span>
                        {isRenewable && (
                          <TooltipRoot>
                            <TooltipTrigger asChild>
                              <span
                                className="ml-2 inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary transition-colors duration-200"
                              >
                                <RefreshCw className="h-2.5 w-2.5" />
                                {remaining != null ? `auto · ${remaining}` : "auto"}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {remaining != null
                                ? `Renovações automáticas restantes: ${remaining}`
                                : "Renovação automática ativada"}
                            </TooltipContent>
                          </TooltipRoot>
                        )}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">{formatDateBR(p.payment_date)}</TableCell>
                      <TableCell><PlanBadge name={p.plans?.name} /></TableCell>
                      <TableCell className="text-right font-mono font-medium tabular-nums">{formatBRL(p.amount)}</TableCell>
                      <TableCell className="text-xs">{paymentMethodLabel(p.payment_method)}</TableCell>
                      <TableCell><PaymentStatusBadge status={p.status} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{p.notes ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center rounded-lg border border-border/60 bg-background/50 p-0.5 shadow-sm divide-x divide-border/60">
                          <div className="flex items-center px-0.5">
                            <TooltipRoot>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  aria-label={isRenewable ? "Desativar renovação automática" : "Ativar renovação automática"}
                                  aria-pressed={isRenewable}
                                  className={cn(
                                    "h-8 w-8 rounded-md transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 active:scale-[0.96]",
                                    isRenewable && "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
                                  )}
                                  onClick={() => onToggleAutoRenew(p)}
                                >
                                  <RefreshCw className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {isRenewable ? "Desativar renovação automática" : "Ativar renovação automática"}
                              </TooltipContent>
                            </TooltipRoot>
                          </div>
                          <div className="flex items-center px-0.5">
                            <TooltipRoot>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  aria-label="Renovar pagamento"
                                  disabled={!canRenew}
                                  className="h-8 w-8 rounded-md transition-all duration-200 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 active:scale-[0.96] disabled:opacity-40 disabled:cursor-not-allowed"
                                  onClick={() => onRenew(p)}
                                >
                                  {isRenewing ? (
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Plus className="h-4 w-4" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {p.status === "paid"
                                  ? "Renovar (criar próximo pagamento)"
                                  : "Só pagamentos pagos podem ser renovados"}
                              </TooltipContent>
                            </TooltipRoot>
                            <TooltipRoot>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  aria-label="Transferir para outro aluno"
                                  className="h-8 w-8 rounded-md transition-all duration-200 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 active:scale-[0.96]"
                                  onClick={() => onTransfer(p)}
                                >
                                  <ArrowRightLeft className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Transferir para outro aluno</TooltipContent>
                            </TooltipRoot>
                          </div>
                          <div className="flex items-center px-0.5">
                            <TooltipRoot>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  aria-label="Editar pagamento"
                                  className="h-8 w-8 rounded-md transition-all duration-200 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 active:scale-[0.96]"
                                  onClick={() => onEdit(p)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Editar</TooltipContent>
                            </TooltipRoot>
                            <TooltipRoot>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  aria-label="Excluir pagamento"
                                  className="h-8 w-8 rounded-md transition-all duration-200 hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-1 active:scale-[0.96]"
                                  onClick={() => onDelete(p)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Excluir</TooltipContent>
                            </TooltipRoot>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                    {pkg && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={8} className="pt-0 pb-4">
                          <CheckinPackagePanel payment={p} pkg={pkg} />
                        </TableCell>
                      </TableRow>
                    )}
                    </Fragment>
                    );
                  })}
                  <TableRow className="bg-muted/40 font-medium">
                    <TableCell colSpan={3} className="text-xs">
                      Resumo {year}: {paidRows.length} pagamento{paidRows.length === 1 ? "" : "s"}
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatBRL(total)}</TableCell>
                    <TableCell colSpan={3} className="text-xs text-muted-foreground">
                      Ticket médio: {formatBRL(avg)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          );
        })
      )}
    </Card>
  );
}

/* ------------------------- Check-ins do pacote -------------------------- */

type CheckinPkg = { quota: number; isOverride: boolean; used: string[]; validUntil: string | null; freezeDays: number };

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Distribui os check-ins (FIFO) entre os pagamentos de planos do tipo pacote. */
function allocateCheckins(
  payments: PaymentRow[],
  attendanceDates: string[],
  freezes: any[],
): Map<string, CheckinPkg> {
  const result = new Map<string, CheckinPkg>();

  const packages = payments
    .filter((p) => p.status === "paid" && p.plans?.checkin_quota_type === "package")
    .sort((a, b) => (a.payment_date < b.payment_date ? -1 : 1))
    .map((p) => {
      const freezeDays = (freezes ?? [])
        .filter((f) => f.payment_id === p.id)
        .reduce((s, f) => s + Number(f.freeze_days ?? 0), 0);
      const quota = p.checkin_quota_override ?? p.plans?.checkin_quota_amount ?? 0;
      const validDays = p.plans?.package_valid_days ?? null;
      return {
        id: p.id,
        start: p.payment_date.slice(0, 10),
        validUntil: validDays != null ? addDays(p.payment_date.slice(0, 10), validDays + freezeDays) : null,
        quota,
        isOverride: p.checkin_quota_override != null,
        freezeDays,
        used: [] as string[],
      };
    });

  if (!packages.length) return result;

  const dates = [...attendanceDates].map((d) => d.slice(0, 10)).sort();
  for (const date of dates) {
    const target = packages.find(
      (pk) => pk.used.length < pk.quota && date >= pk.start && (!pk.validUntil || date <= pk.validUntil),
    );
    if (target) target.used.push(date);
  }

  for (const pk of packages) {
    result.set(pk.id, {
      quota: pk.quota,
      isOverride: pk.isOverride,
      used: pk.used,
      validUntil: pk.validUntil,
      freezeDays: pk.freezeDays,
    });
  }
  return result;
}

function CheckinPackagePanel({ payment, pkg }: { payment: PaymentRow; pkg: CheckinPkg }) {
  const qc = useQueryClient();
  const [showAll, setShowAll] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<string>(String(pkg.quota ?? ""));
  const [saving, setSaving] = useState(false);

  const used = pkg.used.length;
  const remaining = Math.max(0, pkg.quota - used);
  const pct = pkg.quota > 0 ? Math.min(100, (used / pkg.quota) * 100) : 0;
  const tone = remaining === 0 ? "destructive" : remaining <= Math.ceil(pkg.quota * 0.2) ? "warning" : "primary";

  const barClass =
    tone === "destructive" ? "bg-destructive" : tone === "warning" ? "bg-amber-500 dark:bg-amber-400" : "bg-primary";
  const ringClass =
    tone === "destructive"
      ? "border-destructive/25 bg-destructive/5"
      : tone === "warning"
        ? "border-amber-500/25 bg-amber-500/5"
        : "border-primary/20 bg-primary/5";

  async function save(value: number | null) {
    setSaving(true);
    const { error } = await supabase
      .from("payments")
      .update({ checkin_quota_override: value })
      .eq("id", payment.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(value == null ? "Cota do plano restaurada" : "Cota ajustada");
    setEditOpen(false);
    qc.invalidateQueries({ queryKey: ["student-payments"] });
  }

  const visible = showAll ? pkg.used : pkg.used.slice(0, 6);

  return (
    <div className={cn("rounded-xl border p-4 transition-colors duration-200", ringClass)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-center gap-2">
            <Ticket className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-semibold leading-none tracking-tight">Check-ins do pacote</h4>
            {pkg.isOverride && (
              <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                cota ajustada
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:flex sm:items-end sm:gap-8">
            <div>
              <p className="text-2xl font-semibold leading-tight tabular-nums">{remaining}</p>
              <p className="text-xs leading-tight text-muted-foreground">Restantes</p>
            </div>
            <div>
              <p className="text-base font-medium leading-tight tabular-nums text-foreground/80">{used}</p>
              <p className="text-xs leading-tight text-muted-foreground">Usados</p>
            </div>
            <div>
              <p className="text-base font-medium leading-tight tabular-nums text-foreground/80">{pkg.quota}</p>
              <p className="text-xs leading-tight text-muted-foreground">Cota</p>
            </div>
            {pkg.validUntil && (
              <div>
                <p className="text-base font-medium leading-tight tabular-nums text-foreground/80">
                  {formatDateBR(pkg.validUntil)}
                </p>
                <p className="text-xs leading-tight text-muted-foreground">
                  Válido até{pkg.freezeDays > 0 ? ` (+${pkg.freezeDays}d)` : ""}
                </p>
              </div>
            )}
          </div>

          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full transition-all duration-300", barClass)}
              style={{ width: `${pct}%` }}
            />
          </div>

          {used > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {visible.map((d) => (
                <span
                  key={d}
                  className="rounded-full bg-muted/70 px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground"
                >
                  {formatDateBR(d)}
                </span>
              ))}
              {pkg.used.length > 6 && (
                <button
                  type="button"
                  onClick={() => setShowAll((v) => !v)}
                  className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-primary transition-colors duration-200 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {showAll ? "ver menos" : `ver todas (${pkg.used.length})`}
                </button>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Nenhum check-in utilizado neste pacote.</p>
          )}
        </div>

        <Popover open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (o) setDraft(String(pkg.quota ?? "")); }}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="shrink-0 transition-all duration-200 active:scale-[0.97]">
              <Pencil className="h-3.5 w-3.5" /> Ajustar
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold leading-none">Cota de check-ins</p>
              <p className="text-xs leading-snug text-muted-foreground">
                Vale só para este pagamento. Limpe para voltar à cota do plano
                {payment.plans?.checkin_quota_amount != null ? ` (${payment.plans.checkin_quota_amount})` : ""}.
              </p>
            </div>
            <Input
              type="number"
              min={0}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="tabular-nums"
            />
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={saving || !pkg.isOverride}
                onClick={() => save(null)}
              >
                Limpar
              </Button>
              <Button
                size="sm"
                disabled={saving || draft === "" || Number(draft) < 0 || Number.isNaN(Number(draft))}
                onClick={() => save(Number(draft))}
              >
                {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : null} Salvar
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

/* ---------------------------- Attendance Tab ---------------------------- */

const MONTH_NAMES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

function AttendanceTab({
  payments, studentCreatedAt,
}: {
  payments: PaymentRow[];
  studentCreatedAt: string;
}) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  const startMonthKey = useMemo(() => {
    const sortedPaid = payments
      .filter((p) => p.status === "paid")
      .map((p) => p.reference_month)
      .sort();
    if (sortedPaid.length) return sortedPaid[0];
    return monthKey(new Date(studentCreatedAt));
  }, [payments, studentCreatedAt]);

  const availableYears = useMemo(() => {
    const startY = Number(startMonthKey.slice(0, 4));
    const arr: number[] = [];
    for (let y = currentYear; y >= startY; y--) arr.push(y);
    return arr;
  }, [startMonthKey, currentYear]);

  const monthStatusForYear = (year: number) => {
    const result: { month: number; status: "paid" | "pending" | "absent" | "na" }[] = [];
    const [sy, sm] = startMonthKey.split("-").map(Number);
    const nowY = currentYear;
    const nowM = new Date().getMonth() + 1;
    for (let m = 1; m <= 12; m++) {
      const key = `${year}-${String(m).padStart(2, "0")}`;
      // before student start
      if (year < sy || (year === sy && m < sm)) {
        result.push({ month: m, status: "na" });
        continue;
      }
      // future
      if (year > nowY || (year === nowY && m > nowM)) {
        result.push({ month: m, status: "na" });
        continue;
      }
      const ps = payments.filter((p) => p.reference_month === key);
      if (ps.some((p) => p.status === "paid")) result.push({ month: m, status: "paid" });
      else if (ps.some((p) => p.status === "pending" || p.status === "overdue")) result.push({ month: m, status: "pending" });
      else result.push({ month: m, status: "absent" });
    }
    return result;
  };

  const grid = useMemo(() => monthStatusForYear(selectedYear), [selectedYear, startMonthKey, payments]);

  const yearStats = useMemo(() => {
    const paidMonths = grid.filter((g) => g.status === "paid").length;
    const expected = grid.filter((g) => g.status !== "na").length;
    const absent = grid.filter((g) => g.status === "absent").length;
    const rate = expected ? (paidMonths / expected) * 100 : 0;
    const totalPaid = payments
      .filter((p) => p.status === "paid" && p.reference_month.startsWith(String(selectedYear)))
      .reduce((s, p) => s + Number(p.amount), 0);
    return { paidMonths, expected, absent, rate, totalPaid };
  }, [grid, payments, selectedYear]);

  const yearlyEvolution = useMemo(() => {
    return availableYears
      .slice()
      .sort((a, b) => a - b)
      .map((y) => {
        const g = monthStatusForYear(y);
        const paidMonths = g.filter((x) => x.status === "paid").length;
        const expected = g.filter((x) => x.status !== "na").length;
        const absent = g.filter((x) => x.status === "absent").length;
        const yearPaid = payments.filter(
          (p) => p.status === "paid" && p.reference_month.startsWith(String(y)),
        );
        const total = yearPaid.reduce((s, p) => s + Number(p.amount), 0);
        const avg = paidMonths ? total / paidMonths : 0;
        const rate = expected ? (paidMonths / expected) * 100 : 0;
        return { year: y, paidMonths, absent, total, avg, rate };
      })
      .sort((a, b) => b.year - a.year);
  }, [availableYears, payments, startMonthKey]);

  const cellClass = (status: string) =>
    cn(
      "flex h-20 flex-col items-center justify-center rounded-lg border text-xs font-medium",
      status === "paid" && "bg-success/15 border-success/30 text-success",
      status === "pending" && "bg-warning/15 border-warning/30 text-warning-foreground",
      status === "absent" && "bg-destructive/10 border-destructive/20 text-destructive",
      status === "na" && "bg-muted/40 border-border text-muted-foreground",
    );

  const statusLabel = (s: string) =>
    s === "paid" ? "PAGO" : s === "pending" ? "PENDENTE" : s === "absent" ? "AUSENTE" : "N/A";

  return (
    <div className="space-y-6">
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Mapa de frequência — {selectedYear}</h2>
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {availableYears.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12">
          {grid.map((g) => (
            <div key={g.month} className={cellClass(g.status)}>
              <span className="text-[11px] uppercase">{MONTH_NAMES[g.month - 1]}</span>
              <span className="mt-1 text-[10px] font-semibold">{statusLabel(g.status)}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <LegendDot className="bg-success" label="Pago" />
          <LegendDot className="bg-warning" label="Pendente" />
          <LegendDot className="bg-destructive" label="Ausente" />
          <LegendDot className="bg-muted" label="N/A" />
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard label="Meses pagos no ano" value={yearStats.paidMonths} />
        <KPICard label="Meses ausentes" value={yearStats.absent} />
        <KPICard label="Total pago no ano" value={formatBRL(yearStats.totalPaid)} />
        <Card className="p-5">
          <div className="text-sm font-medium text-muted-foreground">Taxa de frequência</div>
          <div className="mt-2 text-2xl font-bold font-mono">
            {yearStats.rate.toFixed(1).replace(".", ",")}%
          </div>
          <Progress value={yearStats.rate} className="mt-3" />
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold">Evolução Anual</h2>
        {yearlyEvolution.length === 0 ? (
          <EmptyState title="Sem dados" description="Sem histórico anual" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ano</TableHead>
                <TableHead className="text-right">Meses Pagos</TableHead>
                <TableHead className="text-right">Meses Ausentes</TableHead>
                <TableHead className="text-right">Total Pago</TableHead>
                <TableHead className="text-right">Ticket Médio</TableHead>
                <TableHead className="text-right">Taxa de Frequência</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {yearlyEvolution.map((r) => (
                <TableRow key={r.year}>
                  <TableCell className="font-medium">{r.year}</TableCell>
                  <TableCell className="text-right font-mono">{r.paidMonths}</TableCell>
                  <TableCell className="text-right font-mono">{r.absent}</TableCell>
                  <TableCell className="text-right font-mono">{formatBRL(r.total)}</TableCell>
                  <TableCell className="text-right font-mono">{formatBRL(r.avg)}</TableCell>
                  <TableCell className="text-right font-mono">
                    {r.rate.toFixed(1).replace(".", ",")}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-3 w-3 rounded-sm", className)} />
      {label}
    </span>
  );
}
