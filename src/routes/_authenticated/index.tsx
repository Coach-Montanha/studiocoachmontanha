import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
  Legend,
} from "recharts";
import { DollarSign, Users, TrendingDown, Activity } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
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

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [{ title: "Dashboard — EduFinance" }] }),
  component: Dashboard,
});

type Payment = {
  id: string; amount: number; payment_date: string; reference_month: string;
  payment_method: string; status: string;
  student_id: string; plan_id: string | null;
  students: { name: string } | null;
  plans: { name: string } | null;
};

function Dashboard() {
  const [month, setMonth] = useState(currentMonthKey());
  const prevMonth = addMonths(month, -1);

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["payments-with-rels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("id,amount,payment_date,reference_month,payment_method,status,student_id,plan_id,students(name),plans(name)")
        .order("payment_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Payment[];
    },
  });

  const { data: studentCount = 0 } = useQuery({
    queryKey: ["students-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("students")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");
      return count ?? 0;
    },
  });

  const k = useMemo(() => {
    const paidThis = payments.filter((p) => p.reference_month === month && p.status === "paid");
    const paidPrev = payments.filter((p) => p.reference_month === prevMonth && p.status === "paid");
    const sum = (arr: Payment[]) => arr.reduce((s, p) => s + Number(p.amount), 0);
    const revThis = sum(paidThis);
    const revPrev = sum(paidPrev);
    const ticket = paidThis.length ? revThis / paidThis.length : 0;
    const ticketPrev = paidPrev.length ? revPrev / paidPrev.length : 0;

    const studentsThis = new Set(paidThis.map((p) => p.student_id));
    const studentsPrev = new Set(paidPrev.map((p) => p.student_id));
    const churned = [...studentsPrev].filter((s) => !studentsThis.has(s)).length;

    const revTrend = revPrev ? ((revThis - revPrev) / revPrev) * 100 : 0;
    const ticketTrend = ticketPrev ? ((ticket - ticketPrev) / ticketPrev) * 100 : 0;

    return { revThis, revTrend, ticket, ticketTrend, churned, paidThis };
  }, [payments, month, prevMonth]);

  // 12 months bar
  const monthlySeries = useMemo(() => {
    const series: { month: string; total: number; label: string }[] = [];
    for (let i = 11; i >= 0; i--) {
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
    for (let i = 11; i >= 0; i--) {
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
    return [...map].map(([name, value]) => ({ name, value }));
  }, [k.paidThis]);

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

  const recent = payments.slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visão geral financeira do mês selecionado</p>
        </div>
        <MonthYearPicker value={month} onChange={setMonth} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="Receita do mês"
          value={formatBRL(k.revThis)}
          icon={<DollarSign className="h-5 w-5" />}
          trend={{ value: k.revTrend }}
          hint="vs mês anterior"
        />
        <KPICard
          label="Alunos ativos"
          value={studentCount}
          icon={<Users className="h-5 w-5" />}
          hint="status ativo"
        />
        <KPICard
          label="Ticket médio"
          value={formatBRL(k.ticket)}
          icon={<Activity className="h-5 w-5" />}
          trend={{ value: k.ticketTrend }}
        />
        <KPICard
          label="Churn do mês"
          value={k.churned}
          icon={<TrendingDown className="h-5 w-5" />}
          hint="pagaram no mês anterior, não pagaram agora"
          trend={{ value: 0 }}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold">Receita mensal (últimos 12 meses)</h2>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={monthlySeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatBRL(v)} />
                <Bar dataKey="total" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold">Evolução de alunos pagantes</h2>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={studentsSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="active" stroke="var(--color-chart-2)" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold">Distribuição por plano (mês)</h2>
          <div className="h-64">
            {byPlan.length ? (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={byPlan} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                    {byPlan.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatBRL(v)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <EmptyState title="Sem dados" description="Nenhum pagamento neste mês" />}
          </div>
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
                  <Tooltip formatter={(v: number) => formatBRL(v)} />
                  <Bar dataKey="value" fill="var(--color-chart-2)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyState title="Sem dados" description="Nenhum pagamento neste mês" />}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold">Pagamentos recentes</h2>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Carregando…</div>
        ) : recent.length === 0 ? (
          <EmptyState title="Nenhum pagamento registrado" description="Comece adicionando seu primeiro pagamento" />
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
