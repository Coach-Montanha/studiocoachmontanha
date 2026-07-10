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
  Legend,
} from "recharts";
import { DollarSign, Users, TrendingDown, Activity } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
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
  const navigate = useNavigate();
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

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["payments-with-rels"],
    queryFn: async () => {
      let allRows: Payment[] = [];
      let from = 0;
      const PAGE = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("payments")
          .select("id,amount,payment_date,reference_month,payment_method,status,student_id,plan_id,students(name),plans(name)")
          .order("payment_date", { ascending: false })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        allRows = allRows.concat((data ?? []) as unknown as Payment[]);
        if (!data || data.length < PAGE) break;
        from += PAGE;
      }
      return allRows;
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

  const { data: birthdayStudents = [] } = useQuery({
    queryKey: ["birthday-students"],
    queryFn: async () => {
      const currentMonth = new Date().getMonth() + 1;
      const { data } = await supabase
        .from("students")
        .select("id,name,email,phone,birth_date,status")
        .not("birth_date", "is", null)
        .order("birth_date");
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
    const churned = (allMonths || useRange) ? 0 : [...studentsPrev].filter((s) => !studentsThis.has(s)).length;

    const revTrend = (allMonths || useRange) ? 0 : (revPrev ? ((revThis - revPrev) / revPrev) * 100 : 0);
    const ticketTrend = (allMonths || useRange) ? 0 : (ticketPrev ? ((ticket - ticketPrev) / ticketPrev) * 100 : 0);

    return { revThis, revTrend, ticket, ticketTrend, churned, paidThis };
  }, [payments, month, prevMonth, allMonths, useRange, rangeStart, rangeEnd]);

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

  const recent = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return payments
      .filter((p) => p.payment_date >= cutoffStr)
      .sort((a, b) => (a.payment_date < b.payment_date ? 1 : -1));
  }, [payments]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label={allMonths ? "Receita total (todos os meses)" : useRange ? "Receita do período" : "Receita do mês"}
          value={formatBRL(k.revThis)}
          icon={<DollarSign className="h-5 w-5" />}
          trend={(allMonths || useRange) ? undefined : { value: k.revTrend }}
          hint={(allMonths || useRange) ? undefined : "vs mês anterior"}
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
          trend={(allMonths || useRange) ? undefined : { value: k.ticketTrend }}
        />
        <KPICard
          label={(allMonths || useRange) ? "Churn (não aplicável)" : "Churn do mês"}
          value={(allMonths || useRange) ? "—" : k.churned}
          icon={<TrendingDown className="h-5 w-5" />}
          hint="pagaram no mês anterior, não pagaram agora"
          trend={{ value: 0 }}
        />
      </div>

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
                          className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 hover:bg-emerald-200"
                        >
                          💬 WhatsApp
                        </a>
                      )}
                      {emailUrl && (
                        <a
                          href={emailUrl}
                          className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 hover:bg-blue-200"
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
