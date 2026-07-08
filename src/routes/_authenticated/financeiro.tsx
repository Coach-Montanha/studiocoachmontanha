import { createFileRoute } from "@tanstack/react-router";
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

export const Route = createFileRoute("/_authenticated/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro — EduFinance" }] }),
  component: FinanceiroPage,
});

const SEGMENT_LABELS: Record<string, string> = {
  general: "Geral",
  studio: "Studio",
  pt: "Personal Trainer",
};

const COLORS = [
  "#4F46E5",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
  "#6B7280",
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

function FinanceiroPage() {
  const qc = useQueryClient();
  const [month, setMonth] = useState(currentMonthKey());
  const [segment, setSegment] = useState("all");
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseRow | null>(null);

  const { data: allExpenses = [] } = useQuery({
    queryKey: ["expenses-all"],
    queryFn: async () => {
      let all: ExpenseRow[] = [];
      let from = 0;
      while (true) {
        const { data } = await supabase
          .from("expenses")
          .select("*,expense_categories(name,icon,color,segment,type)")
          .order("expense_date", { ascending: false })
          .range(from, from + 999);
        all = all.concat((data ?? []) as unknown as ExpenseRow[]);
        if (!data || data.length < 1000) break;
        from += 1000;
      }
      return all;
    },
  });

  const { data: allPayments = [] } = useQuery({
    queryKey: ["payments-financeiro"],
    queryFn: async () => {
      let all: { amount: number; reference_month: string }[] = [];
      let from = 0;
      while (true) {
        const { data } = await supabase
          .from("payments")
          .select("amount,reference_month,status")
          .eq("status", "paid")
          .range(from, from + 999);
        all = all.concat((data ?? []) as { amount: number; reference_month: string }[]);
        if (!data || data.length < 1000) break;
        from += 1000;
      }
      return all;
    },
  });

  const { data: allPtPayments = [] } = useQuery({
    queryKey: ["pt-payments-financeiro"],
    queryFn: async () => {
      let all: { amount: number; reference_month: string | null }[] = [];
      let from = 0;
      while (true) {
        const { data } = await supabase
          .from("pt_payments")
          .select("amount,reference_month,status")
          .eq("status", "paid")
          .range(from, from + 999);
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
        color: e.expense_categories?.color ?? "#6B7280",
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
    if (!confirm("Excluir esta despesa?")) return;
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Despesa excluída");
    qc.invalidateQueries();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Financeiro</h1>
          <p className="text-sm text-muted-foreground">
            Balanço completo de receitas e despesas
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6">
        <KPICard
          label="Receita"
          value={formatBRL(kpis.revenue)}
          icon={<TrendingUp className="h-4 w-4" />}
          hint={segment === "all" ? "Studio + PT" : SEGMENT_LABELS[segment]}
        />
        <KPICard
          label="Despesas totais"
          value={formatBRL(kpis.totalExpenses)}
          icon={<TrendingDown className="h-4 w-4" />}
        />
        <KPICard
          label="Despesas fixas"
          value={formatBRL(kpis.fixedExpenses)}
          icon={<Wallet className="h-4 w-4" />}
        />
        <KPICard
          label="Despesas variáveis"
          value={formatBRL(kpis.variableExpenses)}
          icon={<Wallet className="h-4 w-4" />}
        />
        <KPICard
          label={kpis.profit >= 0 ? "✅ Lucro líquido" : "❌ Prejuízo"}
          value={formatBRL(Math.abs(kpis.profit))}
          icon={<DollarSign className="h-4 w-4" />}
          hint={`Margem: ${kpis.margin.toFixed(1)}%`}
        />
        <KPICard
          label="Margem"
          value={`${kpis.margin.toFixed(1)}%`}
          icon={<Scale className="h-4 w-4" />}
          hint={kpis.margin >= 0 ? "Positiva" : "Negativa"}
        />
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="expenses">Despesas</TabsTrigger>
          <TabsTrigger value="dre">DRE</TabsTrigger>
          <TabsTrigger value="cashflow">Fluxo de Caixa</TabsTrigger>
        </TabsList>

        {/* TAB: Visão Geral */}
        <TabsContent value="overview">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <h3 className="mb-3 text-sm font-semibold">Receita vs Despesas (12 meses)</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlySeries}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => formatBRL(v)} />
                    <Legend />
                    <Bar dataKey="receita" fill="#10B981" name="Receita" />
                    <Bar dataKey="despesas" fill="#EF4444" name="Despesas" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="mb-3 text-sm font-semibold">Lucro líquido (12 meses)</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlySeries}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => formatBRL(v)} />
                    <Line
                      type="monotone"
                      dataKey="lucro"
                      stroke="#4F46E5"
                      strokeWidth={2}
                      name="Lucro"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="mb-3 text-sm font-semibold">
                Despesas por categoria — {formatMonthLabel(month)}
              </h3>
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
                        <Tooltip formatter={(v: number) => formatBRL(v)} />
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
            </Card>

            <Card className="p-5">
              <h3 className="mb-3 text-sm font-semibold">
                Balanço do mês — {formatMonthLabel(month)}
              </h3>
              <div className="space-y-1 text-sm">
                {[
                  { label: "Receita Studio", value: monthRevenue.studio, color: "text-emerald-600" },
                  { label: "Receita PT", value: monthRevenue.pt, color: "text-emerald-600" },
                  {
                    label: "Total receita",
                    value: monthRevenue.total,
                    color: "text-emerald-700",
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
                    color: "text-red-700",
                    bold: true,
                  },
                  {
                    label: "Lucro líquido",
                    value: kpis.profit,
                    color: kpis.profit >= 0 ? "text-emerald-700" : "text-destructive",
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
                        kpis.margin >= 0 ? "text-emerald-600" : "text-destructive"
                      }`}
                    >
                      {kpis.margin.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          </div>
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
            <h3 className="mb-3 text-sm font-semibold">
              DRE — Demonstrativo de Resultado (últimos 12 meses)
            </h3>
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
                          row.profit >= 0 ? "text-emerald-600" : "text-destructive"
                        }`}
                      >
                        {formatBRL(row.profit)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono ${
                          row.margin >= 0 ? "text-emerald-600" : "text-destructive"
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
                  <Tooltip formatter={(v: number) => formatBRL(v)} />
                  <Legend />
                  <Bar dataKey="receita" fill="#10B981" name="Entradas" />
                  <Bar dataKey="despesas" fill="#EF4444" name="Saídas" />
                  <Bar dataKey="lucro" fill="#4F46E5" name="Saldo" />
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
                              row.profit >= 0 ? "text-emerald-600" : "text-destructive"
                            }`}
                          >
                            {formatBRL(row.profit)}
                          </TableCell>
                          <TableCell
                            className={`text-right font-mono ${
                              accumulated >= 0 ? "text-emerald-600" : "text-destructive"
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
      </Tabs>

      <ExpenseDialog open={expenseOpen} onOpenChange={setExpenseOpen} expense={editing} />
    </div>
  );
}
