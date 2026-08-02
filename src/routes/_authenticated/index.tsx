import { chartTooltip } from "@/lib/chart-theme";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { LANDING_STORAGE_KEY, LANDING_REDIRECT_FLAG } from "@/hooks/use-landing-page";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  
} from "recharts";
import {
  DollarSign, Users, TrendingDown, Activity,
  AlertCircle, ArrowRight, Clock, UserX,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { cn } from "@/lib/utils";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { KPICard } from "@/components/edufinance/KPICard";
import { MonthYearPicker } from "@/components/edufinance/MonthYearPicker";
import {
  addMonths, currentMonthKey, formatBRL, formatDateBR, formatMonthLabel,
  paymentMethodLabel,
} from "@/lib/format";
import { PaymentStatusBadge, PlanBadge } from "@/components/edufinance/Badges";
import { EmptyState } from "@/components/edufinance/EmptyState";

import { useScopeFilter } from "@/hooks/use-scope-filter";
import { PackageAlerts } from "@/components/edufinance/PackageAlerts";
import { useLocalStorage } from "@/hooks/use-local-storage";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Eye } from "lucide-react";

const HISTORY_MONTHS = 24;
const VISIBLE_MONTHS = 6;

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [{ title: "Dashboard — EduFinance" }] }),
  component: Dashboard,
});

/** Tile clicável do bloco "Precisa da sua atenção". Tons via tokens de estado. */
const attentionTones = {
  late: "border-state-late/25 bg-state-late-soft text-state-late hover:border-state-late/50",
  pending: "border-state-pending/25 bg-state-pending-soft text-state-pending hover:border-state-pending/50",
  frozen: "border-state-frozen/25 bg-state-frozen-soft text-state-frozen hover:border-state-frozen/50",
} as const;

function AttentionTile({
  tone, icon: Icon, count, label, hint, onClick,
}: {
  tone: keyof typeof attentionTones;
  icon: LucideIcon;
  count: number;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={count === 0}
      className={cn(
        "focus-ring group flex items-center gap-3 rounded-xl border p-3.5 text-left transition-ui",
        attentionTones[tone],
        count === 0
          ? "cursor-default opacity-45"
          : "hover:-translate-y-0.5 hover:shadow-card active:translate-y-0",
      )}
    >
      <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-card/70">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-numeric block text-xl leading-none">{count}</span>
        <span className="text-caption mt-1 block truncate font-semibold">{label}</span>
        <span className="text-caption block truncate opacity-70">{hint}</span>
      </span>
      {count > 0 && (
        <ArrowRight
          aria-hidden
          className="h-4 w-4 shrink-0 opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-70"
        />
      )}
    </button>
  );
}

type AttentionRow = {
  id: string;
  studentId: string;
  name: string;
  plan: string | null;
  amount: number;
  date: string | null;
};

const attentionViews = {
  late: {
    title: "Alunos em atraso",
    icon: AlertCircle,
    capsule: "bg-state-late-soft text-state-late ring-state-late/20",
    accent: "text-state-late",
    empty: "Nenhum pagamento em atraso neste mês",
    seeAll: { label: "Ver em Pagamentos", to: "/payments" as const },
  },
  pending: {
    title: "Aguardando pagamento",
    icon: Clock,
    capsule: "bg-state-pending-soft text-state-pending ring-state-pending/20",
    accent: "text-state-pending",
    empty: "Nenhum pagamento pendente neste mês",
    seeAll: { label: "Ver em Pagamentos", to: "/payments" as const },
  },
  missing: {
    title: "Sem registro no mês",
    icon: UserX,
    capsule: "bg-state-frozen-soft text-state-frozen ring-state-frozen/20",
    accent: "text-state-frozen",
    empty: "Todos os alunos ativos têm lançamento neste mês",
    seeAll: { label: "Ver em Alunos", to: "/students" as const },
  },
} as const;

/** Lista exclusiva dos alunos por situação, com atalho para cada perfil. */
function AttentionListDialog({
  view, monthLabel, data, onClose, onGo, onSeeAll,
}: {
  view: keyof typeof attentionViews | null;
  monthLabel: string;
  data: {
    overdue: { total: number; rows: AttentionRow[] };
    pending: { total: number; rows: AttentionRow[] };
    missingList: AttentionRow[];
  };
  onClose: () => void;
  onGo: (studentId: string) => void;
  onSeeAll: (to: "/payments" | "/students") => void;
}) {
  const cfg = view ? attentionViews[view] : null;
  const rows: AttentionRow[] = !view
    ? []
    : view === "late"
    ? data.overdue.rows
    : view === "pending"
    ? data.pending.rows
    : data.missingList;
  const total =
    view === "late" ? data.overdue.total : view === "pending" ? data.pending.total : null;
  const Icon = cfg?.icon ?? AlertCircle;

  return (
    <Dialog open={!!view} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] gap-0 overflow-y-auto sm:max-w-2xl">
        {cfg && (
          <>
            <DialogHeader>
              <div className="flex items-start gap-3">
                <span
                  aria-hidden
                  className={cn(
                    "grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ring-inset",
                    cfg.capsule,
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <DialogTitle className="text-base leading-tight">{cfg.title}</DialogTitle>
                  <DialogDescription className="mt-1">
                    Mês de referência: {monthLabel}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {rows.length ? (
              <div className="mt-4 space-y-4">
                <div className={cn("grid gap-3", total !== null ? "grid-cols-2" : "grid-cols-1")}>
                  <div className="rounded-xl border border-border bg-muted/40 p-3">
                    <div className="text-overline text-muted-foreground">Alunos</div>
                    <div className="text-numeric mt-1 text-xl text-foreground">{rows.length}</div>
                  </div>
                  {total !== null && (
                    <div className="rounded-xl border border-border bg-muted/40 p-3">
                      <div className="text-overline text-muted-foreground">Valor total</div>
                      <div className={cn("text-numeric mt-1 text-xl", cfg.accent)}>
                        {formatBRL(total)}
                      </div>
                    </div>
                  )}
                </div>

                <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                  {rows.map((row) => (
                    <li key={row.id}>
                      <button
                        type="button"
                        onClick={() => onGo(row.studentId)}
                        className="focus-ring group flex min-h-11 w-full items-center gap-3 px-3.5 py-3 text-left transition-colors duration-200 hover:bg-muted/60 active:bg-muted"
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold uppercase ring-1 ring-inset",
                            cfg.capsule,
                          )}
                        >
                          {row.name.slice(0, 2)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-foreground">
                            {row.name}
                          </span>
                          <span className="text-caption mt-0.5 block truncate text-muted-foreground">
                            {row.date
                              ? `${row.plan ? `${row.plan} · ` : ""}${formatDateBR(row.date)}`
                              : "sem lançamento neste mês"}
                          </span>
                        </span>
                        {row.amount > 0 && (
                          <span className="text-numeric shrink-0 text-sm text-foreground">
                            {formatBRL(row.amount)}
                          </span>
                        )}
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5" />
                      </button>
                    </li>
                  ))}
                </ul>

                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="transition-ui"
                    onClick={() => onSeeAll(cfg.seeAll.to)}
                  >
                    {cfg.seeAll.label}
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <EmptyState title="Tudo em dia" description={cfg.empty} />
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}


type Payment = {
  id: string; amount: number; payment_date: string; reference_month: string;
  payment_method: string; status: string;
  student_id: string; plan_id: string | null;
  students: { name: string } | null;
  plans: { name: string } | null;
};

function Dashboard() {
  const navigate = useNavigate();
  const { scopeId, scopeKey, ready } = useScopeFilter();
  useEffect(() => {
    if (sessionStorage.getItem(LANDING_REDIRECT_FLAG)) return;
    sessionStorage.setItem(LANDING_REDIRECT_FLAG, "1");
    const target = localStorage.getItem(LANDING_STORAGE_KEY);
    if (target && target !== "/") {
      navigate({ to: target, replace: true });
    }
  }, [navigate]);
  const [month, setMonth] = useState(currentMonthKey());
  const [allMonths, setAllMonths] = useState(false);
  const [useRange, setUseRange] = useState(false);
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const prevMonth = addMonths(month, -1);
  // Sliding window over monthlySeries/studentsSeries (both length HISTORY_MONTHS, chronological).
  // offset = 0 shows the most recent VISIBLE_MONTHS months; larger offset shifts back in time.
  const [chartOffset, setChartOffset] = useState(0);
  const maxChartOffset = Math.max(0, HISTORY_MONTHS - VISIBLE_MONTHS);

  const [kpiOrder, setKpiOrder] = useLocalStorage<string[]>(
    "dashboard.kpiOrder",
    ["revenue", "students", "late", "pending", "ticket", "churn"]
  );
  const [hiddenKpis, setHiddenKpis] = useLocalStorage<string[]>(
    "dashboard.hiddenKpis",
    []
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setKpiOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }

  function toggleKpi(id: string) {
    setHiddenKpis((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["payments-with-rels", scopeKey],
    enabled: ready,
    queryFn: async () => {
      let allRows: Payment[] = [];
      let from = 0;
      const PAGE = 1000;
      while (true) {
        let q = supabase
          .from("payments")
          .select("id,amount,payment_date,reference_month,payment_method,status,student_id,plan_id,students(name),plans(name)")
          .is("deleted_at", null)
          .order("payment_date", { ascending: false })
          .range(from, from + PAGE - 1);
        if (scopeId) q = q.eq("user_id", scopeId);
        const { data, error } = await q;
        if (error) throw error;
        allRows = allRows.concat((data ?? []) as unknown as Payment[]);
        if (!data || data.length < PAGE) break;
        from += PAGE;
      }
      return allRows;
    },
  });

  const { data: activeStudents = [] } = useQuery({
    queryKey: ["students-active-light", scopeKey],
    enabled: ready,
    queryFn: async () => {
      let q = supabase
        .from("students")
        .select("id,name")
        .is("deleted_at", null)
        .eq("status", "active")
        .order("name");
      if (scopeId) q = q.eq("user_id", scopeId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
  });
  const studentCount = activeStudents.length;


  const { data: birthdayStudents = [] } = useQuery({
    queryKey: ["birthday-students", scopeKey],
    enabled: ready,
    queryFn: async () => {
      const currentMonth = new Date().getMonth() + 1;
      let q = supabase
        .from("students")
        .select("id,name,email,phone,birth_date,status")
        .is("deleted_at", null)
        .not("birth_date", "is", null)
        .order("birth_date");
      if (scopeId) q = q.eq("user_id", scopeId);
      const { data } = await q;
      return (data ?? []).filter((s) => {
        if (!s.birth_date) return false;
        const month = new Date(s.birth_date + "T12:00").getMonth() + 1;
        return month === currentMonth;
      });
    },
  });


  const k = useMemo(() => {
    const paidThis = useRange
      ? payments.filter((p) => {
          if (p.status !== "paid") return false;
          if (rangeStart && p.payment_date < rangeStart) return false;
          if (rangeEnd && p.payment_date > rangeEnd) return false;
          return true;
        })
      : allMonths
      ? payments.filter((p) => p.status === "paid")
      : payments.filter((p) => p.reference_month === month && p.status === "paid");
    const paidPrev = useRange || allMonths
      ? []
      : payments.filter((p) => p.reference_month === prevMonth && p.status === "paid");
    const sum = (arr: Payment[]) => arr.reduce((s, p) => s + Number(p.amount), 0);
    const revThis = sum(paidThis);
    const revPrev = sum(paidPrev);
    const ticket = paidThis.length ? revThis / paidThis.length : 0;
    const ticketPrev = paidPrev.length ? revPrev / paidPrev.length : 0;

    const studentsThis = new Set(paidThis.map((p) => p.student_id));
    const studentsPrev = new Set(paidPrev.map((p) => p.student_id));
    const churnedList = (allMonths || useRange)
      ? []
      : [...studentsPrev]
          .filter((s) => !studentsThis.has(s))
          .map((studentId) => {
            const rows = paidPrev.filter((p) => p.student_id === studentId);
            const last = rows.reduce((a, b) => (a.payment_date >= b.payment_date ? a : b));
            return {
              studentId,
              name: last.students?.name ?? "Aluno",
              plan: last.plans?.name ?? null,
              amount: rows.reduce((s, p) => s + Number(p.amount), 0),
              date: last.payment_date,
            };
          })
          .sort((a, b) => b.amount - a.amount);
    const churned = churnedList.length;

    const revTrend = (allMonths || useRange) ? 0 : (revPrev ? ((revThis - revPrev) / revPrev) * 100 : 0);
    const ticketTrend = (allMonths || useRange) ? 0 : (ticketPrev ? ((ticket - ticketPrev) / ticketPrev) * 100 : 0);

    return { revThis, revTrend, ticket, ticketTrend, churned, churnedList, paidThis };
  }, [payments, month, prevMonth, allMonths, useRange, rangeStart, rangeEnd]);

  const [churnOpen, setChurnOpen] = useState(false);
  const [attentionView, setAttentionView] = useState<"late" | "pending" | "missing" | null>(null);

  const churnLost = useMemo(() => k.churnedList.reduce((s, r) => s + r.amount, 0), [k.churnedList]);


  // monthly revenue history
  const monthlySeries = useMemo(() => {
    const series: { month: string; total: number; label: string }[] = [];
    for (let i = HISTORY_MONTHS - 1; i >= 0; i--) {
      const m = addMonths(month, -i);
      const total = payments
        .filter((p) => p.reference_month === m && p.status === "paid")
        .reduce((s, p) => s + Number(p.amount), 0);
      series.push({ month: m, label: formatMonthLabel(m), total });
    }
    return series;
  }, [payments, month]);

  // active students per month
  const studentsSeries = useMemo(() => {
    const series: { label: string; active: number }[] = [];
    for (let i = HISTORY_MONTHS - 1; i >= 0; i--) {
      const m = addMonths(month, -i);
      const set = new Set(
        payments.filter((p) => p.reference_month === m && p.status === "paid").map((p) => p.student_id),
      );
      series.push({ label: formatMonthLabel(m), active: set.size });
    }
    return series;
  }, [payments, month]);

  // distribution by plan (this month)
  const byPlan = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of k.paidThis) {
      const name = p.plans?.name ?? "Sem plano";
      map.set(name, (map.get(name) ?? 0) + Number(p.amount));
    }
    const rows = [...map].map(([name, value]) => ({ name, value }));
    const total = rows.reduce((s, r) => s + r.value, 0);
    return rows
      .map((r) => ({ ...r, pct: total > 0 ? (r.value / total) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);
  }, [k.paidThis]);

  const byPlanTotal = useMemo(() => byPlan.reduce((s, r) => s + r.value, 0), [byPlan]);


  // payment methods (this month)
  const byMethod = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of k.paidThis) {
      const key = paymentMethodLabel(p.payment_method);
      map.set(key, (map.get(key) ?? 0) + Number(p.amount));
    }
    return [...map].map(([name, value]) => ({ name, value }));
  }, [k.paidThis]);

  const colors = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)"];

  const recent = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return payments
      .filter((p) => p.payment_date >= cutoffStr)
      .sort((a, b) => (a.payment_date < b.payment_date ? 1 : -1));
  }, [payments]);

  /**
   * "Precisa da sua atenção": deriva do mesmo array de pagamentos já carregado —
   * zero query nova. Mostra só o que exige ação humana hoje.
   */
  const attention = useMemo(() => {
    const thisMonth = currentMonthKey();
    const ofMonth = payments.filter((p) => p.reference_month === thisMonth);
    const overdue = ofMonth.filter((p) => p.status === "overdue");
    const pending = ofMonth.filter((p) => p.status === "pending");
    const sum = (arr: Payment[]) => arr.reduce((s, p) => s + Number(p.amount), 0);
    const toRows = (arr: Payment[]) =>
      arr
        .map((p) => ({
          id: p.id,
          studentId: p.student_id,
          name: p.students?.name ?? "Aluno",
          plan: p.plans?.name ?? null,
          amount: Number(p.amount),
          date: p.payment_date,
        }))
        .sort((a, b) => b.amount - a.amount);
    const touched = new Set(ofMonth.map((p) => p.student_id));
    const missingList = activeStudents
      .filter((s) => !touched.has(s.id))
      .map((s) => ({ id: s.id, studentId: s.id, name: s.name, plan: null, amount: 0, date: null }));
    return {
      overdue: { count: overdue.length, total: sum(overdue), rows: toRows(overdue) },
      pending: { count: pending.length, total: sum(pending), rows: toRows(pending) },
      missing: missingList.length,
      missingList,
      month: thisMonth,
      any: overdue.length > 0 || pending.length > 0 || missingList.length > 0,
    };
  }, [payments, activeStudents]);



  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 items-end gap-4 border-b border-border pb-5 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <p className="text-overline mb-1 text-muted-foreground">Visão geral</p>
          <h1 className="text-display text-foreground">Dashboard</h1>
          <p className="text-caption mt-1.5 text-muted-foreground">
            {useRange
              ? rangeStart && rangeEnd
                ? `Período: ${new Date(rangeStart + "T00:00").toLocaleDateString("pt-BR")} até ${new Date(rangeEnd + "T00:00").toLocaleDateString("pt-BR")}`
                : "Selecione o período"
              : allMonths
              ? "Visão geral financeira de todos os períodos"
              : "Visão geral financeira do mês selecionado"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setAllMonths(false); setUseRange(false); }}
            className={!allMonths && !useRange ? "border-primary text-primary" : ""}
          >
            Mês
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setAllMonths(true); setUseRange(false); }}
            className={allMonths ? "border-primary text-primary" : ""}
          >
            Todos os meses
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setAllMonths(false); setUseRange(true); }}
            className={useRange ? "border-primary text-primary" : ""}
          >
            Período
          </Button>
          </Button>
          {hiddenKpis.length > 0 && (
            <div className="flex items-center gap-1.5 border-l border-border pl-2">
              <span className="text-xs font-medium text-muted-foreground">Ocultos:</span>
              {hiddenKpis.map((id) => (
                <Button
                  key={id}
                  variant="secondary"
                  size="sm"
                  className="h-7 gap-1 px-2 text-[10px]"
                  onClick={() => toggleKpi(id)}
                >
                  <Eye className="h-3 w-3" />
                  {id === "revenue"
                    ? "Receita"
                    : id === "students"
                    ? "Alunos"
                    : id === "late"
                    ? "Atrasos"
                    : id === "pending"
                    ? "Pendentes"
                    : id === "ticket"
                    ? "Ticket"
                    : "Churn"}
                </Button>
              ))}
            </div>
          )}
          {!allMonths && !useRange && <MonthYearPicker value={month} onChange={setMonth} />}
          {useRange && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              />
              <span className="text-xs text-muted-foreground">até</span>
              <input
                type="date"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              />
            </div>
          )}
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={kpiOrder} strategy={verticalListSortingStrategy}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {kpiOrder.map((id) => {
              if (hiddenKpis.includes(id)) return null;

              if (id === "revenue")
                return (
                  <SortableKPICard
                    key={id}
                    id={id}
                    label={
                      allMonths
                        ? "Receita total"
                        : useRange
                        ? "Receita do período"
                        : "Receita do mês"
                    }
                    value={formatBRL(k.revThis)}
                    icon={<DollarSign className="h-5 w-5" />}
                    trend={allMonths || useRange ? undefined : { value: k.revTrend }}
                    hint={allMonths || useRange ? undefined : "vs mês anterior"}
                    onHide={() => toggleKpi(id)}
                  />
                );

              if (id === "students")
                return (
                  <SortableKPICard
                    key={id}
                    id={id}
                    label="Alunos ativos"
                    value={studentCount}
                    icon={<Users className="h-5 w-5" />}
                    hint="status ativo"
                    onHide={() => toggleKpi(id)}
                  />
                );

              if (id === "late")
                return (
                  <SortableKPICard
                    key={id}
                    id={id}
                    label="Em atraso"
                    value={attention.overdue.count}
                    icon={<AlertCircle className="h-5 w-5" />}
                    hint={formatBRL(attention.overdue.total)}
                    onClick={() => setAttentionView("late")}
                    onHide={() => toggleKpi(id)}
                  />
                );

              if (id === "pending")
                return (
                  <SortableKPICard
                    key={id}
                    id={id}
                    label="Pendentes"
                    value={attention.pending.count}
                    icon={<Clock className="h-5 w-5" />}
                    hint={formatBRL(attention.pending.total)}
                    onClick={() => setAttentionView("pending")}
                    onHide={() => toggleKpi(id)}
                  />
                );

              if (id === "ticket")
                return (
                  <SortableKPICard
                    key={id}
                    id={id}
                    label="Ticket médio"
                    value={formatBRL(k.ticket)}
                    icon={<Activity className="h-5 w-5" />}
                    trend={allMonths || useRange ? undefined : { value: k.ticketTrend }}
                    onHide={() => toggleKpi(id)}
                  />
                );

              if (id === "churn")
                return (
                  <SortableKPICard
                    key={id}
                    id={id}
                    label={
                      allMonths || useRange ? "Churn (N/A)" : "Churn do mês"
                    }
                    value={allMonths || useRange ? "—" : k.churned}
                    icon={<TrendingDown className="h-5 w-5" />}
                    hint="vs mês anterior"
                    onClick={() => setChurnOpen(true)}
                    disabled={allMonths || useRange || k.churned === 0}
                    onHide={() => toggleKpi(id)}
                  />
                );

              return null;
            })}
          </div>
        </SortableContext>
      </DndContext>

      <Dialog open={churnOpen} onOpenChange={setChurnOpen}>
        <DialogContent className="max-h-[88vh] gap-0 overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-state-late-soft text-state-late ring-1 ring-inset ring-state-late/20"
              >
                <TrendingDown className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <DialogTitle className="text-base leading-tight">Churn do mês</DialogTitle>
                <DialogDescription className="mt-1">
                  Alunos que pagaram em {formatMonthLabel(prevMonth)} e ainda não têm pagamento em{" "}
                  {formatMonthLabel(month)}.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {k.churnedList.length ? (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border bg-muted/40 p-3">
                  <div className="text-overline text-muted-foreground">Alunos</div>
                  <div className="text-numeric mt-1 text-xl text-foreground">{k.churnedList.length}</div>
                </div>
                <div className="rounded-xl border border-state-late/25 bg-state-late-soft p-3">
                  <div className="text-overline text-state-late/80">Receita em risco</div>
                  <div className="text-numeric mt-1 text-xl text-state-late">{formatBRL(churnLost)}</div>
                </div>
              </div>

              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {k.churnedList.map((row) => (
                  <li key={row.studentId}>
                    <button
                      type="button"
                      onClick={() => {
                        setChurnOpen(false);
                        navigate({ to: "/students/$id", params: { id: row.studentId } });
                      }}
                      className="focus-ring flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors duration-200 hover:bg-muted/60"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-foreground">{row.name}</span>
                        <span className="text-caption mt-0.5 block truncate text-muted-foreground">
                          {row.plan ? `${row.plan} · ` : ""}último em {formatDateBR(row.date)}
                        </span>
                      </span>
                      <span className="text-numeric shrink-0 text-sm text-foreground">{formatBRL(row.amount)}</span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="mt-4">
              <EmptyState title="Nenhum churn" description="Nenhum aluno deixou de pagar neste mês" />
            </div>
          )}
        </DialogContent>
      </Dialog>


      {attention.any && (
        <SectionCard
          title="Precisa da sua atenção"
          description="Situação do mês corrente"
          icon={AlertCircle}
          actions={
            <Button
              variant="ghost"
              size="sm"
              className="transition-ui"
              onClick={() => navigate({ to: "/payments" })}
            >
              Ver pagamentos
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          }
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <AttentionTile
              tone="late"
              icon={AlertCircle}
              count={attention.overdue.count}
              label="Em atraso"
              hint={formatBRL(attention.overdue.total)}
              onClick={() => setAttentionView("late")}
            />
            <AttentionTile
              tone="pending"
              icon={Clock}
              count={attention.pending.count}
              label="Aguardando pagamento"
              hint={formatBRL(attention.pending.total)}
              onClick={() => setAttentionView("pending")}
            />
            <AttentionTile
              tone="frozen"
              icon={UserX}
              count={attention.missing}
              label="Sem registro no mês"
              hint="alunos ativos sem lançamento"
              onClick={() => setAttentionView("missing")}
            />
          </div>
        </SectionCard>
      )}

      <PackageAlerts />

      <AttentionListDialog
        view={attentionView}
        monthLabel={formatMonthLabel(attention.month)}
        data={attention}
        onClose={() => setAttentionView(null)}
        onGo={(id) => {
          setAttentionView(null);
          navigate({ to: "/students/$id", params: { id } });
        }}
        onSeeAll={(to) => {
          setAttentionView(null);
          navigate({ to });
        }}
      />




      {birthdayStudents.length > 0 && (
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xl">🎂</span>
            <h2 className="text-sm font-semibold">
              Aniversariantes do mês ({birthdayStudents.length})
            </h2>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {birthdayStudents.map((s) => {
              const day = new Date(s.birth_date + "T12:00").getDate();
              const isToday = day === new Date().getDate();
              const msg = encodeURIComponent(
                `Feliz aniversário, ${s.name}! 🎂 Desejamos um dia incrível e muito sucesso na sua jornada!`
              );
              const whatsappUrl = s.phone
                ? `https://wa.me/55${s.phone.replace(/\D/g, "")}?text=${msg}`
                : null;
              const emailUrl = s.email
                ? `mailto:${s.email}?subject=Feliz%20Anivers%C3%A1rio!&body=${msg}`
                : null;
              return (
                <div key={s.id} className="flex items-start gap-2 rounded-lg border p-2">
                  <div className="text-xl">{isToday ? "🎉" : "🎂"}</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Dia {day}{isToday ? " — hoje! 🎉" : ""}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {whatsappUrl && (
                        <a
                          href={whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="focus-ring rounded bg-state-paid-soft px-1.5 py-0.5 text-[10px] font-medium text-state-paid transition-ui hover:brightness-95"
                        >
                          💬 WhatsApp
                        </a>
                      )}
                      {emailUrl && (
                        <a
                          href={emailUrl}
                          className="focus-ring rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary transition-ui hover:bg-primary/20"
                        >
                          📧 Email
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}



      {(() => {
        // Windowed slice: chartOffset = 0 → last VISIBLE_MONTHS months.
        const end = monthlySeries.length - chartOffset;
        const start = Math.max(0, end - VISIBLE_MONTHS);
        const monthlyWindow = monthlySeries.slice(start, end);
        const studentsWindow = studentsSeries.slice(start, end);
        const rangeLabel = monthlyWindow.length
          ? `${monthlyWindow[0].label} — ${monthlyWindow[monthlyWindow.length - 1].label}`
          : "";
        const canPrev = chartOffset < maxChartOffset;
        const canNext = chartOffset > 0;
        const NavButtons = (
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={!canPrev}
              onClick={() => setChartOffset((o) => Math.min(maxChartOffset, o + VISIBLE_MONTHS))}
              title="Período anterior"
            >
              ‹
            </Button>
            <span className="min-w-[8rem] text-center text-[11px] font-medium text-muted-foreground">
              {rangeLabel}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={!canNext}
              onClick={() => setChartOffset((o) => Math.max(0, o - VISIBLE_MONTHS))}
              title="Período seguinte"
            >
              ›
            </Button>
          </div>
        );
        return (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">Receita mensal ({VISIBLE_MONTHS} meses)</h2>
                {NavButtons}
              </div>
              <div className="h-64">
                <ResponsiveContainer>
                  <BarChart data={monthlyWindow}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} width={50} />
                    <Tooltip {...chartTooltip} formatter={(v: number) => formatBRL(v)} />
                    <Bar dataKey="total" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">Evolução de alunos pagantes</h2>
                {NavButtons}
              </div>
              <div className="h-64">
                <ResponsiveContainer>
                  <LineChart data={studentsWindow}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={40} />
                    <Tooltip {...chartTooltip} />
                    <Line type="monotone" dataKey="active" stroke="var(--color-chart-2)" strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        );
      })()}

      <div className="grid gap-4 lg:grid-cols-2">



        <Card className="p-5">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold leading-tight">Distribuição por plano (mês)</h2>
            {byPlan.length > 0 && (
              <span className="text-xs text-muted-foreground tabular-nums">{byPlan.length} planos</span>
            )}
          </div>
          {byPlan.length ? (
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="relative h-56 w-full sm:h-52 sm:w-52 sm:shrink-0">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={byPlan} dataKey="value" nameKey="name" innerRadius={58} outerRadius={90} paddingAngle={2} stroke="none">
                      {byPlan.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                    </Pie>
                    <Tooltip
                      {...chartTooltip}
                      formatter={(v: number, _n, item) =>
                        `${formatBRL(v)} · ${((item?.payload?.pct ?? 0) as number).toFixed(1).replace(".", ",")}%`
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-base font-semibold leading-none tabular-nums text-foreground">
                    {formatBRL(byPlanTotal)}
                  </span>
                  <span className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">total do mês</span>
                </div>
              </div>

              <ul className="flex w-full min-w-0 flex-col gap-1">
                {byPlan.map((row, i) => (
                  <li
                    key={row.name}
                    className="rounded-md px-2 py-1.5 transition-colors duration-200 hover:bg-muted/60"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ background: colors[i % colors.length] }}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{row.name}</span>
                      <span className="text-sm font-semibold tabular-nums text-foreground">
                        {row.pct.toFixed(1).replace(".", ",")}%
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 pl-[18px]">
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full transition-[width] duration-300"
                          style={{ width: `${row.pct}%`, background: colors[i % colors.length] }}
                        />
                      </div>
                      <span className="text-xs tabular-nums text-muted-foreground">{formatBRL(row.value)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="h-64">
              <EmptyState title="Sem dados" description="Nenhum pagamento neste mês" />
            </div>
          )}
        </Card>


        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold">Formas de pagamento (mês)</h2>
          <div className="h-64">
            {byMethod.length ? (
              <ResponsiveContainer>
                <BarChart data={byMethod} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip {...chartTooltip} formatter={(v: number) => formatBRL(v)} />
                  <Bar dataKey="value" fill="var(--color-chart-2)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyState title="Sem dados" description="Nenhum pagamento neste mês" />}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold">Pagamentos recentes (últimos 30 dias)</h2>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Carregando…</div>
        ) : recent.length === 0 ? (
          <EmptyState title="Nenhum pagamento registrado" description="Nenhum pagamento nos últimos 30 dias" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aluno</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Método</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.students?.name ?? "—"}</TableCell>
                  <TableCell><PlanBadge name={p.plans?.name} /></TableCell>
                  <TableCell className="font-mono text-xs">{formatDateBR(p.payment_date)}</TableCell>
                  <TableCell className="text-xs">{paymentMethodLabel(p.payment_method)}</TableCell>
                  <TableCell className="text-right font-mono font-medium">{formatBRL(p.amount)}</TableCell>
                  <TableCell><PaymentStatusBadge status={p.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
