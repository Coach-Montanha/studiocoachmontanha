import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Plus, CalendarDays, Wallet, Receipt, TrendingUp,
  Clock, Layers, Pencil, Trash2,
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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { KPICard } from "@/components/edufinance/KPICard";
import { PaymentStatusBadge, PlanBadge, StudentStatusBadge } from "@/components/edufinance/Badges";
import { EmptyState } from "@/components/edufinance/EmptyState";
import { PaymentDialog } from "@/components/edufinance/PaymentDialog";
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
  plans: { name: string } | null;
};

function StudentDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<PaymentRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PaymentRow | null>(null);

  const { data: student } = useQuery({
    queryKey: ["student", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id,name,email,phone,status,notes,created_at,student_plan_history(id,start_date,end_date,is_current,plans(name,price))")
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
        .select("id,student_id,amount,payment_date,reference_month,payment_method,status,notes,plan_id,plans(name)")
        .eq("student_id", id)
        .order("payment_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PaymentRow[];
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
    return attendance.filter((d) => {
      if (attendancePeriod === "all") return true;
      if (attendancePeriod === "year") return d.startsWith(y);
      if (attendancePeriod === "month") return d.startsWith(ym);
      return true;
    }).length;
  }, [attendance, attendancePeriod]);

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
    const { error } = await supabase.from("payments").delete().eq("id", deleteTarget.id);
    if (error) return toast.error(error.message);
    toast.success("Pagamento excluído");
    qc.invalidateQueries();
    setDeleteTarget(null);
  }


  return (
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
        <div className="flex gap-2">
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
                    <Tooltip formatter={(v: number) => formatBRL(v)} />
                    <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
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
        </TabsContent>

        <TabsContent value="payments">
          <PaymentsTab
            payments={payments}
            onEdit={(p) => { setEditingPayment(p); setPaymentOpen(true); }}
            onDelete={(p) => setDeleteTarget(p)}
            onAdd={() => { setEditingPayment(null); setPaymentOpen(true); }}
          />
        </TabsContent>

        <TabsContent value="attendance">
          <AttendanceTab payments={payments} studentCreatedAt={student.created_at} />
        </TabsContent>
      </Tabs>

      <PaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        defaultStudentId={id}
        payment={editingPayment ?? undefined}
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
  );
}

/* ----------------------------- Payments Tab ----------------------------- */

function PaymentsTab({
  payments, onEdit, onDelete, onAdd,
}: {
  payments: PaymentRow[];
  onEdit: (p: PaymentRow) => void;
  onDelete: (p: PaymentRow) => void;
  onAdd: () => void;
}) {
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

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
                  {rows.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs capitalize">{formatMonthLong(p.reference_month)}</TableCell>
                      <TableCell className="text-xs font-mono">{formatDateBR(p.payment_date)}</TableCell>
                      <TableCell><PlanBadge name={p.plans?.name} /></TableCell>
                      <TableCell className="text-right font-mono font-medium">{formatBRL(p.amount)}</TableCell>
                      <TableCell className="text-xs">{paymentMethodLabel(p.payment_method)}</TableCell>
                      <TableCell><PaymentStatusBadge status={p.status} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{p.notes ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => onEdit(p)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => onDelete(p)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
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
