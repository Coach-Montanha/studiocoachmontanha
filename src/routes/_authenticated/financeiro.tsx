import { chartTooltip } from "@/lib/chart-theme";
import {
  Receipt,
  FileSpreadsheet,
  FileText,
  Download,
  Activity,
  BarChart3,
  Dumbbell,
} from "lucide-react";

import { Wallet as PageIcon } from "lucide-react";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { createFileRoute } from "@tanstack/react-router";
import { confirmDialog } from "@/lib/confirm-dialog";
import { exportDreToExcel, exportDreToPdf } from "@/lib/dre-export";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Pencil,
  Trash2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Scale,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { KPICard } from "@/components/edufinance/KPICard";
import { useModules } from "@/hooks/use-modules";
import { StudioAnalyticsPanel } from "@/components/financeiro/StudioAnalyticsPanel";
import { PtAnalyticsPanel } from "@/components/financeiro/PtAnalyticsPanel";
import { Skeleton } from "@/components/ui/skeleton";

import { EmptyState } from "@/components/edufinance/EmptyState";
import { ExpenseDialog } from "@/components/financeiro/ExpenseDialog";
import { MonthYearPicker } from "@/components/edufinance/MonthYearPicker";
import {
  formatBRL,
  formatDateBR,
  currentMonthKey,
  addMonths,
  formatMonthLabel,
} from "@/lib/format";
import { useScopeFilter } from "@/hooks/use-scope-filter";
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
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Eye } from "lucide-react";
import { SortableChartCard, HiddenChartChips } from "@/components/edufinance/SortableChartCard";

type FinanceTab = "overview" | "expenses" | "dre" | "cashflow" | "studio" | "pt";

export const Route = createFileRoute("/_authenticated/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro — EduFinance" }] }),
  validateSearch: (s: Record<string, unknown>): { tab?: FinanceTab } => {
    const t = s.tab;
    const allowed: FinanceTab[] = ["overview", "expenses", "dre", "cashflow", "studio", "pt"];
    return typeof t === "string" && (allowed as string[]).includes(t)
      ? { tab: t as FinanceTab }
      : {};
  },
  component: FinanceiroPage,
});


const SEGMENT_LABELS: Record<string, string> = {
  general: "Geral",
  studio: "Studio",
  pt: "Personal Trainer",
};

// Paleta dos gráficos vinda dos tokens do design system (dark mode de graça).
const COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-6)",
  "var(--color-chart-8)",
  "var(--color-chart-7)",
  "var(--color-muted-foreground)",
];

type ExpenseRow = {
  id: string;
  category_id: string | null;
  description: string;
  amount: number;
  expense_date: string;
  reference_month: string;
  segment: string;
  type: string;
  expense_categories: {
    name: string;
    icon: string | null;
    color: string | null;
    segment: string;
    type: string;
  } | null;
};

function SortableKPICard({ id, onHide, ...props }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <KPICard
        {...props}
        onHide={onHide}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

function FinanceiroPage() {
  const qc = useQueryClient();
  const navigate = Route.useNavigate();
  const { tab: tabParam } = Route.useSearch();
  const { hasModule, loading: modulesLoading } = useModules();
  const tab: FinanceTab = tabParam ?? "overview";
  const setTab = (v: string) =>
    navigate({ search: { tab: v as FinanceTab }, replace: true });
  const { scopeId, scopeKey, ready } = useScopeFilter();

  const [month, setMonth] = useState(currentMonthKey());
  const [segment, setSegment] = useState("all");
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseRow | null>(null);

  const [kpiOrder, setKpiOrder] = useLocalStorage<string[]>(
    "financeiro.kpiOrder",
    ["revenue", "expenses", "fixed", "variable", "profit", "margin"]
  );
  const [hiddenKpis, setHiddenKpis] = useLocalStorage<string[]>(
    "financeiro.hiddenKpis",
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

  const [chartOrder, setChartOrder] = useLocalStorage<string[]>(
    "financeiro.chartOrder",
    ["rev-exp", "profit", "categories", "balance"]
  );
  const [hiddenCharts, setHiddenCharts] = useLocalStorage<string[]>(
    "financeiro.hiddenCharts",
    []
  );

  function handleChartDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setChartOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        if (oldIndex < 0 || newIndex < 0) return items;
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }

  function toggleChart(id: string) {
    setHiddenCharts((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }


  const { data: allExpenses = [] } = useQuery({
    queryKey: ["expenses-all", scopeKey],
    enabled: ready,
    queryFn: async () => {
      let all: ExpenseRow[] = [];
      let from = 0;
      let pages = 0;
      while (pages < 20) {
        pages++;
        let q = supabase
          .from("expenses")
          .select("*,expense_categories(name,icon,color,segment,type)")
          .order("expense_date", { ascending: false })
          .range(from, from + 999);
        if (scopeId) q = q.eq("user_id", scopeId);
        const { data, error } = await q;
        if (error) throw error;
        all = all.concat((data ?? []) as unknown as ExpenseRow[]);
        if (!data || data.length < 1000) break;
        from += 1000;
      }
      return all;
    },
  });

  const { data: allPayments = [] } = useQuery({
    queryKey: ["payments-financeiro", scopeKey],
    enabled: ready,
    queryFn: async () => {
      let all: { amount: number; reference_month: string }[] = [];
      let from = 0;
      let pages = 0;
      while (pages < 20) {
        pages++;
        let q = supabase
          .from("payments")
          .select("amount,reference_month,status")
          .is("deleted_at", null)
          .eq("status", "paid")
          .range(from, from + 999);
        if (scopeId) q = q.eq("user_id", scopeId);
        const { data, error } = await q;
        if (error) throw error;
        all = all.concat((data ?? []) as { amount: number; reference_month: string }[]);
        if (!data || data.length < 1000) break;
        from += 1000;
      }
      return all;
    },
  });

  const { data: allPtPayments = [] } = useQuery({
    queryKey: ["pt-payments-financeiro", scopeKey],
    enabled: ready,
    queryFn: async () => {
      let all: { amount: number; reference_month: string | null }[] = [];
      let from = 0;
      let pages = 0;
      while (pages < 20) {
        pages++;
        let q = supabase
          .from("pt_payments")
          .select("amount,reference_month,status")
          .eq("status", "paid")
          .is("deleted_at", null)
          .range(from, from + 999);
        if (scopeId) q = q.eq("user_id", scopeId);
        const { data, error } = await q;
        if (error) throw error;
        all = all.concat(
          (data ?? []) as { amount: number; reference_month: string | null }[],
        );
        if (!data || data.length < 1000) break;
        from += 1000;
      }
      return all;
    },
  });


  const monthExpenses = useMemo(
    () =>
      allExpenses.filter((e) => {
        if (e.reference_month !== month) return false;
        if (segment !== "all" && e.segment !== segment) return false;
        return true;
      }),
    [allExpenses, month, segment],
  );

  const monthRevenue = useMemo(() => {
    const studio = allPayments
      .filter((p) => p.reference_month === month)
      .reduce((s, p) => s + Number(p.amount), 0);
    const pt = allPtPayments
      .filter((p) => p.reference_month === month)
      .reduce((s, p) => s + Number(p.amount), 0);
    return { studio, pt, total: studio + pt };
  }, [allPayments, allPtPayments, month]);

  const kpis = useMemo(() => {
    const totalExpenses = monthExpenses.reduce((s, e) => s + Number(e.amount), 0);
    const fixedExpenses = monthExpenses
      .filter((e) => e.type === "fixed")
      .reduce((s, e) => s + Number(e.amount), 0);
    const variableExpenses = monthExpenses
      .filter((e) => e.type === "variable")
      .reduce((s, e) => s + Number(e.amount), 0);

    const revenue =
      segment === "pt"
        ? monthRevenue.pt
        : segment === "studio"
          ? monthRevenue.studio
          : monthRevenue.total;

    const profit = revenue - totalExpenses;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

    return { revenue, totalExpenses, fixedExpenses, variableExpenses, profit, margin };
  }, [monthExpenses, monthRevenue, segment]);

  const monthlySeries = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = addMonths(month, i - 11);
      const revenueSource =
        segment === "pt"
          ? allPtPayments
          : segment === "studio"
            ? allPayments
            : [...allPayments, ...allPtPayments];
      const revenue = revenueSource
        .filter((p) => p.reference_month === m)
        .reduce((s, p) => s + Number(p.amount), 0);
      const expenses = allExpenses
        .filter(
          (e) => e.reference_month === m && (segment === "all" || e.segment === segment),
        )
        .reduce((s, e) => s + Number(e.amount), 0);
      return {
        label: formatMonthLabel(m),
        receita: revenue,
        despesas: expenses,
        lucro: revenue - expenses,
      };
    });
  }, [month, allPayments, allPtPayments, allExpenses, segment]);

  const byCategory = useMemo(() => {
    const map = new Map<string, { name: string; icon: string; color: string; total: number }>();
    for (const e of monthExpenses) {
      const key = e.category_id ?? "sem-categoria";
      const cur = map.get(key) ?? {
        name: e.expense_categories?.name ?? "Sem categoria",
        icon: e.expense_categories?.icon ?? "📦",
        color: e.expense_categories?.color ?? "var(--color-muted-foreground)",
        total: 0,
      };
      cur.total += Number(e.amount);
      map.set(key, cur);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [monthExpenses]);

  const dreData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = addMonths(month, i - 11);
      const studioRev = allPayments
        .filter((p) => p.reference_month === m)
        .reduce((s, p) => s + Number(p.amount), 0);
      const ptRev = allPtPayments
        .filter((p) => p.reference_month === m)
        .reduce((s, p) => s + Number(p.amount), 0);
      const totalRev = studioRev + ptRev;
      const fixedExp = allExpenses
        .filter((e) => e.reference_month === m && e.type === "fixed")
        .reduce((s, e) => s + Number(e.amount), 0);
      const varExp = allExpenses
        .filter((e) => e.reference_month === m && e.type === "variable")
        .reduce((s, e) => s + Number(e.amount), 0);
      const totalExp = fixedExp + varExp;
      const profit = totalRev - totalExp;
      const margin = totalRev > 0 ? (profit / totalRev) * 100 : 0;
      return {
        month: m,
        label: formatMonthLabel(m),
        studioRev,
        ptRev,
        totalRev,
        fixedExp,
        varExp,
        totalExp,
        profit,
        margin,
      };
    }).reverse();
  }, [month, allPayments, allPtPayments, allExpenses]);

  async function remove(id: string) {
    if (!(await confirmDialog("Excluir esta despesa?"))) return;
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Despesa excluída");
    qc.invalidateQueries({ queryKey: ["expenses-all", scopeKey] });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={PageIcon}
        eyebrow="Gestão"
        title="Financeiro"
        description="Balanço completo de receitas e despesas"
        actions={
          <>
            <MonthYearPicker value={month} onChange={setMonth} />
            <Select value={segment} onValueChange={setSegment}>
              <SelectTrigger className="h-11 w-full sm:h-10 sm:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">🏢 Todos os segmentos</SelectItem>
                <SelectItem value="studio">🎯 Studio</SelectItem>
                <SelectItem value="pt">🏋️ Personal Trainer</SelectItem>
              </SelectContent>
            </Select>
            <Button
              className="h-11 w-full sm:h-10 sm:w-auto"
              onClick={() => {
                setEditing(null);
                setExpenseOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> Nova despesa
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
                      : id === "expenses"
                      ? "Despesas"
                      : id === "fixed"
                      ? "Fixas"
                      : id === "variable"
                      ? "Variáveis"
                      : id === "profit"
                      ? "Lucro"
                      : "Margem"}
                  </Button>
                ))}
              </div>
            )}
          </>
        }
      />

      {/* KPI Cards */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={kpiOrder} strategy={verticalListSortingStrategy}>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6">
            {kpiOrder.map((id) => {
              if (hiddenKpis.includes(id)) return null;

              if (id === "revenue")
                return (
                  <SortableKPICard
                    key={id}
                    id={id}
                    label="Receita"
                    value={formatBRL(kpis.revenue)}
                    icon={<TrendingUp className="h-4 w-4" />}
                    hint={
                      segment === "all" ? "Studio + PT" : SEGMENT_LABELS[segment]
                    }
                    onHide={() => toggleKpi(id)}
                  />
                );

              if (id === "expenses")
                return (
                  <SortableKPICard
                    key={id}
                    id={id}
                    label="Despesas totais"
                    value={formatBRL(kpis.totalExpenses)}
                    icon={<TrendingDown className="h-4 w-4" />}
                    onHide={() => toggleKpi(id)}
                  />
                );

              if (id === "fixed")
                return (
                  <SortableKPICard
                    key={id}
                    id={id}
                    label="Despesas fixas"
                    value={formatBRL(kpis.fixedExpenses)}
                    icon={<Wallet className="h-4 w-4" />}
                    onHide={() => toggleKpi(id)}
                  />
                );

              if (id === "variable")
                return (
                  <SortableKPICard
                    key={id}
                    id={id}
                    label="Despesas variáveis"
                    value={formatBRL(kpis.variableExpenses)}
                    icon={<Wallet className="h-4 w-4" />}
                    onHide={() => toggleKpi(id)}
                  />
                );

              if (id === "profit")
                return (
                  <SortableKPICard
                    key={id}
                    id={id}
                    label={kpis.profit >= 0 ? "✅ Lucro líquido" : "❌ Prejuízo"}
                    value={formatBRL(Math.abs(kpis.profit))}
                    icon={<DollarSign className="h-4 w-4" />}
                    hint={`Margem: ${kpis.margin.toFixed(1)}%`}
                    onHide={() => toggleKpi(id)}
                  />
                );

              if (id === "margin")
                return (
                  <SortableKPICard
                    key={id}
                    id={id}
                    label="Margem"
                    value={`${kpis.margin.toFixed(1)}%`}
                    icon={<Scale className="h-4 w-4" />}
                    hint={kpis.margin >= 0 ? "Positiva" : "Negativa"}
                    onHide={() => toggleKpi(id)}
                  />
                );

              return null;
            })}
          </div>
        </SortableContext>
      </DndContext>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsList className="h-auto w-max gap-1 rounded-xl border border-border/60 bg-muted/40 p-1">
            {[
              { v: "overview", label: "Visão Geral", short: "Visão", icon: Wallet },
              { v: "expenses", label: "Despesas", short: "Despesas", icon: Receipt },
              { v: "dre", label: "DRE", short: "DRE", icon: FileSpreadsheet },
              { v: "cashflow", label: "Fluxo de Caixa", short: "Fluxo", icon: Activity },
              ...(!modulesLoading && hasModule("studio")
                ? [{ v: "studio", label: "Análise Studio", short: "Studio", icon: BarChart3 }]
                : []),
              ...(!modulesLoading && hasModule("pt")
                ? [{ v: "pt", label: "Análise PT", short: "PT", icon: Dumbbell }]
                : []),
            ].map((t) => (
              <TabsTrigger
                key={t.v}
                value={t.v}
                className="gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-all duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                <t.icon className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">{t.label}</span>
                <span className="sm:hidden">{t.short}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>


        {/* TAB: Visão Geral */}
        <TabsContent value="overview">
          {(() => {
            const chartLabels: Record<string, string> = {
              "rev-exp": "Receita vs Despesas",
              profit: "Lucro líquido",
              categories: "Despesas por categoria",
              balance: "Balanço do mês",
            };

            const renderChart = (id: string) => {
              if (id === "rev-exp")
                return (
                  <SortableChartCard
                    key={id}
                    id={id}
                    title="Receita vs Despesas (12 meses)"
                    onHide={() => toggleChart(id)}
                  >
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlySeries}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="label" />
                          <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                          <Tooltip {...chartTooltip} formatter={(v: number) => formatBRL(v)} />
                          <Legend />
                          <Bar dataKey="receita" fill="var(--color-state-paid)" name="Receita" />
                          <Bar dataKey="despesas" fill="var(--color-state-late)" name="Despesas" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </SortableChartCard>
                );

              if (id === "profit")
                return (
                  <SortableChartCard
                    key={id}
                    id={id}
                    title="Lucro líquido (12 meses)"
                    onHide={() => toggleChart(id)}
                  >
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={monthlySeries}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="label" />
                          <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                          <Tooltip {...chartTooltip} formatter={(v: number) => formatBRL(v)} />
                          <Line
                            type="monotone"
                            dataKey="lucro"
                            stroke="var(--color-chart-1)"
                            strokeWidth={2}
                            name="Lucro"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </SortableChartCard>
                );

              if (id === "categories")
                return (
                  <SortableChartCard
                    key={id}
                    id={id}
                    title={`Despesas por categoria — ${formatMonthLabel(month)}`}
                    onHide={() => toggleChart(id)}
                  >
                    {byCategory.length === 0 ? (
                      <EmptyState title="Sem despesas neste mês" />
                    ) : (
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={byCategory}
                                dataKey="total"
                                nameKey="name"
                                innerRadius={50}
                                outerRadius={90}
                              >
                                {byCategory.map((_c, i) => (
                                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip {...chartTooltip} formatter={(v: number) => formatBRL(v)} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="space-y-2">
                          {byCategory.map((c, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between rounded-md border p-2 text-sm"
                            >
                              <div className="flex items-center gap-2">
                                <span>{c.icon}</span>
                                <span>{c.name}</span>
                              </div>
                              <span className="font-mono font-medium">{formatBRL(c.total)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </SortableChartCard>
                );

              if (id === "balance")
                return (
                  <SortableChartCard
                    key={id}
                    id={id}
                    title={`Balanço do mês — ${formatMonthLabel(month)}`}
                    onHide={() => toggleChart(id)}
                  >
                    <div className="space-y-1 text-sm">
                      {[
                        { label: "Receita Studio", value: monthRevenue.studio, color: "text-state-paid" },
                        { label: "Receita PT", value: monthRevenue.pt, color: "text-state-paid" },
                        {
                          label: "Total receita",
                          value: monthRevenue.total,
                          color: "text-state-paid",
                          bold: true,
                        },
                        {
                          label: "Despesas fixas",
                          value: -kpis.fixedExpenses,
                          color: "text-destructive",
                        },
                        {
                          label: "Despesas variáveis",
                          value: -kpis.variableExpenses,
                          color: "text-destructive",
                        },
                        {
                          label: "Total despesas",
                          value: -kpis.totalExpenses,
                          color: "text-state-late",
                          bold: true,
                        },
                        {
                          label: "Lucro líquido",
                          value: kpis.profit,
                          color: kpis.profit >= 0 ? "text-state-paid" : "text-destructive",
                          bold: true,
                          separator: true,
                        },
                      ].map((row, i) => (
                        <div key={i}>
                          {row.separator && <hr className="my-2" />}
                          <div className="flex items-center justify-between py-1">
                            <span>{row.label}</span>
                            <span
                              className={`font-mono ${row.color} ${row.bold ? "font-semibold" : ""}`}
                            >
                              {formatBRL(Math.abs(row.value))}
                            </span>
                          </div>
                        </div>
                      ))}
                      <div className="mt-2 border-t pt-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">Margem líquida</span>
                          <span
                            className={`font-mono font-semibold ${
                              kpis.margin >= 0 ? "text-state-paid" : "text-destructive"
                            }`}
                          >
                            {kpis.margin.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </SortableChartCard>
                );

              return null;
            };

            return (
              <div className="space-y-3">
                <HiddenChartChips hidden={hiddenCharts} labels={chartLabels} onRestore={toggleChart} />
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleChartDragEnd}>
                  <SortableContext items={chartOrder} strategy={rectSortingStrategy}>
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      {chartOrder.filter((id) => !hiddenCharts.includes(id)).map(renderChart)}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            );
          })()}
        </TabsContent>


        {/* TAB: Despesas */}
        <TabsContent value="expenses">
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                Despesas — {formatMonthLabel(month)}
                {segment !== "all" && ` · ${SEGMENT_LABELS[segment]}`}
              </h3>
              <Button
                size="sm"
                onClick={() => {
                  setEditing(null);
                  setExpenseOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" /> Nova despesa
              </Button>
            </div>
            {monthExpenses.length === 0 ? (
              <EmptyState
                icon={<Wallet className="h-5 w-5" />}
                title="Nenhuma despesa neste mês"
                description="Registre suas despesas para acompanhar o balanço."
                action={
                  <Button onClick={() => setExpenseOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Registrar despesa
                  </Button>
                }
              />
            ) : (
              <div className="-mx-5 overflow-x-auto px-5">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Segmento</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthExpenses.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium">{e.description}</TableCell>
                        <TableCell>
                          {e.expense_categories
                            ? `${e.expense_categories.icon ?? "📦"} ${e.expense_categories.name}`
                            : "—"}
                        </TableCell>
                        <TableCell>{SEGMENT_LABELS[e.segment] ?? e.segment}</TableCell>
                        <TableCell>
                          <span className="text-xs">
                            {e.type === "fixed" ? "🔒 Fixa" : "🔄 Variável"}
                          </span>
                        </TableCell>
                        <TableCell>{formatDateBR(e.expense_date)}</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatBRL(e.amount)}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditing(e);
                                setExpenseOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => remove(e.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={5} className="font-semibold">
                        Total despesas do mês
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {formatBRL(kpis.totalExpenses)}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* TAB: DRE */}
        <TabsContent value="dre">
          <Card className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">
                  DRE — Demonstrativo de Resultado (últimos 12 meses)
                </h3>
                <p className="text-xs text-muted-foreground">
                  Visão contábil detalhada de receitas, despesas e margens operacionais.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={async () => {
                    try {
                      await exportDreToExcel(dreData);
                      toast.success("DRE exportado em Excel (.xlsx) com sucesso!");
                    } catch (err: any) {
                      toast.error("Erro ao exportar Excel: " + err.message);
                    }
                  }}
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  Exportar Excel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={async () => {
                    try {
                      await exportDreToPdf(dreData);
                      toast.success("DRE exportado em PDF com sucesso!");
                    } catch (err: any) {
                      toast.error("Erro ao exportar PDF: " + err.message);
                    }
                  }}
                >
                  <FileText className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  Exportar PDF
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês</TableHead>
                    <TableHead className="text-right">Rec. Studio</TableHead>
                    <TableHead className="text-right">Rec. PT</TableHead>
                    <TableHead className="text-right">Total Receita</TableHead>
                    <TableHead className="text-right">Desp. Fixas</TableHead>
                    <TableHead className="text-right">Desp. Variáveis</TableHead>
                    <TableHead className="text-right">Total Despesas</TableHead>
                    <TableHead className="text-right">Lucro</TableHead>
                    <TableHead className="text-right">Margem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dreData.map((row) => (
                    <TableRow key={row.month}>
                      <TableCell className="font-medium">{row.label}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatBRL(row.studioRev)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatBRL(row.ptRev)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatBRL(row.totalRev)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatBRL(row.fixedExp)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatBRL(row.varExp)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatBRL(row.totalExp)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono ${
                          row.profit >= 0 ? "text-state-paid" : "text-destructive"
                        }`}
                      >
                        {formatBRL(row.profit)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono ${
                          row.margin >= 0 ? "text-state-paid" : "text-destructive"
                        }`}
                      >
                        {row.margin.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* TAB: Fluxo de Caixa */}
        <TabsContent value="cashflow">
          <Card className="p-5">
            <h3 className="mb-3 text-sm font-semibold">Fluxo de Caixa (últimos 12 meses)</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlySeries}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip {...chartTooltip} formatter={(v: number) => formatBRL(v)} />
                  <Legend />
                  <Bar dataKey="receita" fill="var(--color-state-paid)" name="Entradas" />
                  <Bar dataKey="despesas" fill="var(--color-state-late)" name="Saídas" />
                  <Bar dataKey="lucro" fill="var(--color-chart-1)" name="Saldo" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês</TableHead>
                    <TableHead className="text-right">Entradas</TableHead>
                    <TableHead className="text-right">Saídas</TableHead>
                    <TableHead className="text-right">Saldo do mês</TableHead>
                    <TableHead className="text-right">Saldo acumulado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    let accumulated = 0;
                    return [...dreData].reverse().map((row) => {
                      accumulated += row.profit;
                      return (
                        <TableRow key={row.month}>
                          <TableCell className="font-medium">{row.label}</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatBRL(row.totalRev)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatBRL(row.totalExp)}
                          </TableCell>
                          <TableCell
                            className={`text-right font-mono ${
                              row.profit >= 0 ? "text-state-paid" : "text-destructive"
                            }`}
                          >
                            {formatBRL(row.profit)}
                          </TableCell>
                          <TableCell
                            className={`text-right font-mono ${
                              accumulated >= 0 ? "text-state-paid" : "text-destructive"
                            }`}
                          >
                            {formatBRL(accumulated)}
                          </TableCell>
                        </TableRow>
                      );
                    });
                  })()}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* TAB: Análise Studio */}
        {!modulesLoading && hasModule("studio") && (
          <TabsContent value="studio" className="mt-6">
            <StudioAnalyticsPanel />
          </TabsContent>
        )}

        {/* TAB: Análise PT */}
        {!modulesLoading && hasModule("pt") && (
          <TabsContent value="pt" className="mt-6">
            <PtAnalyticsPanel />
          </TabsContent>
        )}

        {modulesLoading && (tab === "studio" || tab === "pt") && (
          <div className="mt-6 space-y-4">
            <Skeleton className="h-8 w-56" />
            <div className="grid gap-4 lg:grid-cols-2">
              <Skeleton className="h-72 rounded-xl" />
              <Skeleton className="h-72 rounded-xl" />
            </div>
          </div>
        )}
      </Tabs>


      <ExpenseDialog open={expenseOpen} onOpenChange={setExpenseOpen} expense={editing} />
    </div>
  );
}
