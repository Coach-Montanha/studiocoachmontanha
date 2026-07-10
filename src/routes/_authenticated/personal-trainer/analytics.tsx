import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, LineChart, Line, Legend,
} from "recharts";
import { format, startOfMonth, subMonths } from "date-fns";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PTBadge } from "@/components/pt/PTBadges";
import { formatBRL, formatMonthLabel } from "@/lib/format";
import { useScopeFilter } from "@/hooks/use-scope-filter";

export const Route = createFileRoute("/_authenticated/personal-trainer/analytics")({
  head: () => ({ meta: [{ title: "Análises PT — EduFinance" }] }),
  component: PTAnalytics,
});

function PTAnalytics() {
  const { data: payments = [] } = useQuery({
    queryKey: ["pt-analytics-payments"],
    queryFn: async () =>
      (await supabase.from("pt_payments").select("amount,status,payment_date,reference_month,pt_plan_id,pt_student_id,pt_plans(name)")).data ?? [],
  });
  const { data: sessions = [] } = useQuery({
    queryKey: ["pt-analytics-sessions"],
    queryFn: async () => (await supabase.from("pt_sessions").select("session_date,status,pt_student_id")).data ?? [],
  });
  const { data: students = [] } = useQuery({
    queryKey: ["pt-analytics-students"],
    queryFn: async () => (await supabase.from("pt_students").select("id,name,status,created_at")).data ?? [],
  });

  const months12 = useMemo(() => {
    const arr: string[] = [];
    for (let i = 11; i >= 0; i--) arr.push(format(startOfMonth(subMonths(new Date(), i)), "yyyy-MM"));
    return arr;
  }, []);

  const revenueByMonth = useMemo(() => {
    const map = new Map(months12.map((m) => [m, 0]));
    for (const p of payments) {
      if (p.status !== "paid") continue;
      const k = (p.reference_month ?? p.payment_date.slice(0, 7));
      if (map.has(k)) map.set(k, (map.get(k) ?? 0) + Number(p.amount));
    }
    return [...map.entries()].map(([k, v]) => ({ month: formatMonthLabel(k), value: v }));
  }, [payments, months12]);

  const revenueByPlan = useMemo(() => {
    const planNames = new Set<string>();
    const byMonth: Record<string, Record<string, number>> = {};
    for (const m of months12) byMonth[m] = {};
    for (const p of payments) {
      if (p.status !== "paid") continue;
      const k = (p.reference_month ?? p.payment_date.slice(0, 7));
      if (!byMonth[k]) continue;
      const name = p.pt_plans?.name ?? "Sem plano";
      planNames.add(name);
      byMonth[k][name] = (byMonth[k][name] ?? 0) + Number(p.amount);
    }
    const data = months12.map((m) => ({ month: formatMonthLabel(m), ...byMonth[m] }));
    return { data, plans: [...planNames] };
  }, [payments, months12]);

  const sessionsByStatusMonth = useMemo(() => {
    const data = months12.map((m) => {
      const inMonth = sessions.filter((s) => s.session_date.startsWith(m));
      return {
        month: formatMonthLabel(m),
        completed: inMonth.filter((x) => x.status === "completed").length,
        cancelled: inMonth.filter((x) => x.status === "cancelled_student" || x.status === "cancelled_trainer").length,
        no_show: inMonth.filter((x) => x.status === "no_show").length,
      };
    });
    return data;
  }, [sessions, months12]);

  const avgAttendance = useMemo(() => {
    return months12.map((m) => {
      const inMonth = sessions.filter((s) => s.session_date.startsWith(m));
      const done = inMonth.filter((s) => s.status === "completed").length;
      return { month: formatMonthLabel(m), rate: inMonth.length ? (done / inMonth.length) * 100 : 0 };
    });
  }, [sessions, months12]);

  const studentStats = useMemo(() => {
    return students.map((st) => {
      const ss = sessions.filter((s) => s.pt_student_id === st.id);
      const done = ss.filter((s) => s.status === "completed").length;
      const absent = ss.filter((s) => s.status === "no_show").length;
      const rate = ss.length ? (done / ss.length) * 100 : 0;
      const ltv = payments.filter((p) => p.pt_student_id === st.id && p.status === "paid").reduce((s, p) => s + Number(p.amount), 0);
      return { id: st.id, name: st.name, status: st.status, total: ss.length, done, absent, rate, ltv };
    });
  }, [students, sessions, payments]);

  const topAttendance = useMemo(() => [...studentStats].filter((s) => s.total >= 3).sort((a, b) => b.rate - a.rate).slice(0, 5), [studentStats]);
  const topAbsences = useMemo(() => [...studentStats].filter((s) => s.absent > 0).sort((a, b) => b.absent - a.absent).slice(0, 5), [studentStats]);
  const topLTV = useMemo(() => [...studentStats].sort((a, b) => b.ltv - a.ltv).slice(0, 10), [studentStats]);

  const activeOverTime = useMemo(() => {
    return months12.map((m) => {
      const end = `${m}-31`;
      const active = students.filter((s) => s.status === "active" && s.created_at.slice(0, 10) <= end).length;
      return { month: formatMonthLabel(m), value: active };
    });
  }, [students, months12]);

  const newVsChurn = useMemo(() => {
    return months12.map((m) => {
      const created = students.filter((s) => s.created_at.startsWith(m)).length;
      const churned = students.filter((s) => s.status === "churned" && s.created_at.startsWith(m)).length;
      return { month: formatMonthLabel(m), novos: created, perdidos: churned };
    });
  }, [students, months12]);

  const planColors = ["hsl(var(--primary))", "hsl(var(--success))", "hsl(var(--warning))", "hsl(var(--destructive))", "#8b5cf6", "#06b6d4"];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Análises PT</h1>
        <PTBadge />
      </div>

      {/* Section 1 — Receita */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Receita PT</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <h3 className="mb-3 text-sm font-semibold">Receita mensal (12 meses)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueByMonth}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatBRL(v)} width={90} />
                  <Tooltip formatter={(v: number) => formatBRL(v)} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card className="p-5">
            <h3 className="mb-3 text-sm font-semibold">Receita por plano</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueByPlan.data}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatBRL(v)} width={90} />
                  <Tooltip formatter={(v: number) => formatBRL(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {revenueByPlan.plans.map((name, i) => (
                    <Bar key={name} dataKey={name} stackId="rev" fill={planColors[i % planColors.length]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </section>

      {/* Section 2 — Frequência */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Frequência</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <h3 className="mb-3 text-sm font-semibold">Taxa média de presença</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={avgAttendance}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v.toFixed(0)}%`} />
                  <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                  <Line type="monotone" dataKey="rate" stroke="hsl(var(--success))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card className="p-5">
            <h3 className="mb-3 text-sm font-semibold">Aulas por status</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sessionsByStatusMonth}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="completed" stackId="s" name="Realizadas" fill="hsl(var(--success))" />
                  <Bar dataKey="cancelled" stackId="s" name="Canceladas" fill="hsl(var(--destructive))" />
                  <Bar dataKey="no_show" stackId="s" name="Faltas" fill="hsl(var(--warning))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <h3 className="mb-3 text-sm font-semibold">Top alunos por presença</h3>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Aluno</TableHead><TableHead className="text-right">Aulas</TableHead><TableHead className="text-right">Taxa</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {topAttendance.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center text-xs text-muted-foreground">Sem dados</TableCell></TableRow>
                ) : topAttendance.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.name}</TableCell>
                    <TableCell className="text-right font-mono">{s.total}</TableCell>
                    <TableCell className="text-right font-mono text-success">{s.rate.toFixed(1).replace(".", ",")}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          <Card className="p-5 border-destructive/30">
            <h3 className="mb-3 text-sm font-semibold">⚠️ Alunos com mais faltas</h3>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Aluno</TableHead><TableHead className="text-right">Faltas</TableHead><TableHead className="text-right">Taxa</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {topAbsences.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center text-xs text-muted-foreground">Sem faltas registradas</TableCell></TableRow>
                ) : topAbsences.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.name}</TableCell>
                    <TableCell className="text-right font-mono text-destructive">{s.absent}</TableCell>
                    <TableCell className="text-right font-mono">{s.rate.toFixed(1).replace(".", ",")}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      </section>

      {/* Section 3 — Alunos */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Alunos PT</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <h3 className="mb-3 text-sm font-semibold">Alunos ativos ao longo do tempo</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={activeOverTime}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card className="p-5">
            <h3 className="mb-3 text-sm font-semibold">Novos vs. perdidos</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={newVsChurn}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="novos" fill="hsl(var(--success))" />
                  <Bar dataKey="perdidos" fill="hsl(var(--destructive))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold">Ranking de LTV</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Aluno</TableHead>
                <TableHead className="text-right">Aulas realizadas</TableHead>
                <TableHead className="text-right">Taxa</TableHead>
                <TableHead className="text-right">LTV</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topLTV.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-xs text-muted-foreground">Sem dados</TableCell></TableRow>
              ) : topLTV.map((s, i) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono">{i + 1}</TableCell>
                  <TableCell>{s.name}</TableCell>
                  <TableCell className="text-right font-mono">{s.done}</TableCell>
                  <TableCell className="text-right font-mono">{s.rate.toFixed(1).replace(".", ",")}%</TableCell>
                  <TableCell className="text-right font-mono font-semibold">{formatBRL(s.ltv)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </section>
    </div>
  );
}
