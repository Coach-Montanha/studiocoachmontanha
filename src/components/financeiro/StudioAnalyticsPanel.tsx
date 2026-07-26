import { chartTooltip } from "@/lib/chart-theme";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, AreaChart, Area, PieChart, Pie, Cell,
} from "recharts";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { YearPicker } from "@/components/edufinance/MonthYearPicker";
import { formatBRL, formatMonthLabel, paymentMethodLabel } from "@/lib/format";
import { EmptyState } from "@/components/edufinance/EmptyState";
import { useScopeFilter } from "@/hooks/use-scope-filter";


type P = {
  amount: number; payment_date: string; reference_month: string;
  payment_method: string; status: string;
  student_id: string; plan_id: string | null;
  students: { name: string } | null;
  plans: { name: string } | null;
};

export function StudioAnalyticsPanel() {
  const { scopeId, scopeKey, ready } = useScopeFilter();
  const [year, setYear] = useState(new Date().getFullYear());
  const [compareYear, setCompareYear] = useState(new Date().getFullYear() - 1);
  const [ltvSort, setLtvSort] = useState<"desc" | "asc" | "alpha">("desc");
  const [ltvPage, setLtvPage] = useState(0);
  const LTV_PER_PAGE = 20;

  const { data: payments = [] } = useQuery({
    queryKey: ["payments-analytics", scopeKey],
    enabled: ready,
    queryFn: async () => {
      let allRows: P[] = [];
      let from = 0;
      const PAGE = 1000;
      while (true) {
        let q = supabase
          .from("payments")
          .select("amount,payment_date,reference_month,payment_method,status,student_id,plan_id,students(name),plans(name)")
          .is("deleted_at", null)
          .eq("status", "paid")
          .range(from, from + PAGE - 1);
        if (scopeId) q = q.eq("user_id", scopeId);
        const { data, error } = await q;
        if (error) throw error;
        allRows = allRows.concat((data ?? []) as unknown as P[]);
        if (!data || data.length < PAGE) break;
        from += PAGE;
      }
      return allRows;
    },
  });


  const months = useMemo(
    () => Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`),
    [year, compareYear],
  );

  // Revenue: year vs prev year
  const revenueData = useMemo(() => {
    return months.map((m, i) => {
      const prevM = `${compareYear}-${String(i + 1).padStart(2, "0")}`;
      const cur = payments.filter((p) => p.reference_month === m).reduce((s, p) => s + Number(p.amount), 0);
      const prev = payments.filter((p) => p.reference_month === prevM).reduce((s, p) => s + Number(p.amount), 0);
      return { label: formatMonthLabel(m), atual: cur, anterior: prev };
    });
  }, [months, payments, compareYear]);

  // Monthly breakdown
  const breakdown = useMemo(() => {
    return months.map((m) => {
      const pays = payments.filter((p) => p.reference_month === m);
      const total = pays.reduce((s, p) => s + Number(p.amount), 0);
      const avg = pays.length ? total / pays.length : 0;
      return { month: m, label: formatMonthLabel(m), total, count: pays.length, avg };
    });
  }, [months, payments]);

  // Student flow
  const studentFlow = useMemo(() => {
    const firstPayment = new Map<string, string>();
    const lastPayment = new Map<string, string>();
    for (const p of payments) {
      const cur = firstPayment.get(p.student_id);
      if (!cur || p.reference_month < cur) firstPayment.set(p.student_id, p.reference_month);
      const last = lastPayment.get(p.student_id);
      if (!last || p.reference_month > last) lastPayment.set(p.student_id, p.reference_month);
    }
    return months.map((m, i) => {
      const prevM = i === 0 ? `${compareYear}-12` : months[i - 1];
      const activeNow = new Set(payments.filter((p) => p.reference_month === m).map((p) => p.student_id));
      const activePrev = new Set(payments.filter((p) => p.reference_month === prevM).map((p) => p.student_id));
      const novos = [...firstPayment.entries()].filter(([, fm]) => fm === m).length;
      const saidas = [...activePrev].filter((s) => !activeNow.has(s)).length;
      const retencao = activePrev.size ? ((activeNow.size - novos) / activePrev.size) * 100 : 0;
      return { label: formatMonthLabel(m), novos, saidas, ativos: activeNow.size, retencao: Number(retencao.toFixed(1)) };
    });
  }, [months, payments, compareYear]);

  // LTV per student
  const ltvData = useMemo(() => {
    const map = new Map<string, { name: string; total: number; plan: string | null }>();
    for (const p of payments) {
      const id = p.student_id;
      const cur = map.get(id) ?? { name: p.students?.name ?? "—", total: 0, plan: p.plans?.name ?? null };
      cur.total += Number(p.amount);
      cur.plan = cur.plan ?? p.plans?.name ?? null;
      map.set(id, cur);
    }
    const arr = [...map.values()].sort((a, b) => b.total - a.total);
    const avg = arr.length ? arr.reduce((s, r) => s + r.total, 0) / arr.length : 0;
    return { rows: arr, avg, top: arr.slice(0, 10) };
  }, [payments]);

  const sortedLtv = useMemo(() => {
    const arr = [...ltvData.rows];
    if (ltvSort === "desc")  arr.sort((a, b) => b.total - a.total);
    if (ltvSort === "asc")   arr.sort((a, b) => a.total - b.total);
    if (ltvSort === "alpha") arr.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    return arr;
  }, [ltvData.rows, ltvSort]);

  const ltvPageRows = sortedLtv.slice(ltvPage * LTV_PER_PAGE, (ltvPage + 1) * LTV_PER_PAGE);
  const ltvTotalPages = Math.max(1, Math.ceil(sortedLtv.length / LTV_PER_PAGE));

  // LTV by plan
  const ltvByPlan = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    for (const r of ltvData.rows) {
      const k = r.plan ?? "Sem plano";
      const cur = map.get(k) ?? { total: 0, count: 0 };
      cur.total += r.total; cur.count++;
      map.set(k, cur);
    }
    return [...map].map(([name, v]) => ({ name, ltv: v.count ? v.total / v.count : 0 }));
  }, [ltvData]);

  // By plan stacked + table
  const yearPays = useMemo(() => payments.filter((p) => p.reference_month.startsWith(String(year))), [payments, year]);

  const planNames = useMemo(() => Array.from(new Set(yearPays.map((p) => p.plans?.name ?? "Sem plano"))), [yearPays]);
  const stackedByPlan = useMemo(() => {
    return months.map((m) => {
      const row: Record<string, string | number> = { label: formatMonthLabel(m) };
      for (const name of planNames) {
        row[name] = yearPays
          .filter((p) => p.reference_month === m && (p.plans?.name ?? "Sem plano") === name)
          .reduce((s, p) => s + Number(p.amount), 0);
      }
      return row;
    });
  }, [months, yearPays, planNames]);

  const planTable = useMemo(() => {
    const total = yearPays.reduce((s, p) => s + Number(p.amount), 0);
    return planNames.map((name) => {
      const pays = yearPays.filter((p) => (p.plans?.name ?? "Sem plano") === name);
      const rev = pays.reduce((s, p) => s + Number(p.amount), 0);
      const students = new Set(pays.map((p) => p.student_id)).size;
      return {
        name, students, rev, avg: pays.length ? rev / pays.length : 0,
        pct: total ? (rev / total) * 100 : 0,
      };
    }).sort((a, b) => b.rev - a.rev);
  }, [yearPays, planNames]);

  // Payment methods
  const byMethod = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of yearPays) {
      const k = paymentMethodLabel(p.payment_method);
      map.set(k, (map.get(k) ?? 0) + Number(p.amount));
    }
    return [...map].map(([name, value]) => ({ name, value }));
  }, [yearPays]);

  const methodTrend = useMemo(() => {
    return months.map((m) => {
      const row: Record<string, string | number> = { label: formatMonthLabel(m) };
      for (const method of ["pix","credit_card","debit_card","bank_slip","cash","transfer"]) {
        row[paymentMethodLabel(method)] = yearPays
          .filter((p) => p.reference_month === m && p.payment_method === method)
          .reduce((s, p) => s + Number(p.amount), 0);
      }
      return row;
    });
  }, [months, yearPays]);

  const colors = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)"];

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <Card className="p-5">
      <h2 className="mb-4 text-base font-semibold">{title}</h2>
      {children}
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-overline mb-1 text-muted-foreground">Studio</p>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Análises do Studio</h2>
          <p className="text-caption mt-1.5 text-muted-foreground">Métricas detalhadas do seu negócio</p>
        </div>

        <div className="flex gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Ano principal</label>
            <YearPicker value={year} onChange={setYear} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Comparar com</label>
            <YearPicker value={compareYear} onChange={setCompareYear} />
          </div>
        </div>
      </div>

      <Section title={`Receita — ${year} vs ${compareYear}`}>
        <div className="h-72">
          <ResponsiveContainer>
            <LineChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
              <Tooltip {...chartTooltip} formatter={(v: number) => formatBRL(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="atual" name={String(year)} stroke="var(--color-chart-1)" strokeWidth={2.5} />
              <Line type="monotone" dataKey="anterior" name={String(compareYear)} stroke="var(--color-chart-3)" strokeWidth={2} strokeDasharray="4 4" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-6 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead className="text-right">Receita</TableHead>
                <TableHead className="text-right"># Pagamentos</TableHead>
                <TableHead className="text-right">Ticket Médio</TableHead>
                <TableHead className="text-right">Crescimento MoM</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {breakdown.map((b, i) => {
                const prev = i > 0 ? breakdown[i - 1].total : 0;
                const mom = prev ? ((b.total - prev) / prev) * 100 : 0;
                return (
                  <TableRow key={b.month}>
                    <TableCell className="capitalize">{b.label}</TableCell>
                    <TableCell className="text-right font-mono">{formatBRL(b.total)}</TableCell>
                    <TableCell className="text-right font-mono">{b.count}</TableCell>
                    <TableCell className="text-right font-mono">{formatBRL(b.avg)}</TableCell>
                    <TableCell className={`text-right font-mono ${mom >= 0 ? "text-success" : "text-destructive"}`}>
                      {i === 0 ? "—" : `${mom >= 0 ? "+" : ""}${mom.toFixed(1)}%`}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Section>

      <Section title="Fluxo de alunos (entradas, saídas, retenção)">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={studentFlow}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip {...chartTooltip} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="ativos" stroke="var(--color-chart-1)" strokeWidth={2.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={studentFlow}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip {...chartTooltip} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="novos" name="Entradas" fill="var(--color-chart-2)" />
                <Bar dataKey="saidas" name="Saídas" fill="var(--color-chart-4)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Section>

      <Section title="LTV — Lifetime Value">
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <div className="rounded-lg bg-muted/40 p-4">
              <div className="text-xs uppercase text-muted-foreground">LTV médio</div>
              <div className="font-mono text-2xl font-bold">{formatBRL(ltvData.avg)}</div>
              <div className="text-xs text-muted-foreground">{ltvData.rows.length} alunos analisados</div>
            </div>
            <h3 className="mt-4 text-sm font-semibold">LTV por plano</h3>
            <div className="mt-2 h-48">
              {ltvByPlan.length ? (
                <ResponsiveContainer>
                  <BarChart data={ltvByPlan}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                    <Tooltip {...chartTooltip} formatter={(v: number) => formatBRL(v)} />
                    <Bar dataKey="ltv" fill="var(--color-chart-2)" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyState title="Sem dados" />}
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">Todos os alunos por LTV ({ltvData.rows.length})</h3>
              <Select value={ltvSort} onValueChange={(v) => { setLtvSort(v as typeof ltvSort); setLtvPage(0); }}>
                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Maior LTV primeiro</SelectItem>
                  <SelectItem value="asc">Menor LTV primeiro</SelectItem>
                  <SelectItem value="alpha">Ordem alfabética</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Aluno</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead className="text-right">LTV</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ltvPageRows.map((r, i) => (
                  <TableRow key={ltvPage * LTV_PER_PAGE + i}>
                    <TableCell className="font-mono text-xs text-muted-foreground">{ltvPage * LTV_PER_PAGE + i + 1}</TableCell>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.plan ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono">{formatBRL(r.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {sortedLtv.length > 0 && (
              <div className="flex items-center justify-between text-sm">
                <div className="text-muted-foreground">Página {ltvPage + 1} de {ltvTotalPages}</div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={ltvPage === 0} onClick={() => setLtvPage((p) => p - 1)}>Anterior</Button>
                  <Button variant="outline" size="sm" disabled={(ltvPage + 1) * LTV_PER_PAGE >= sortedLtv.length} onClick={() => setLtvPage((p) => p + 1)}>Próxima</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Section>

      <Section title="Planos">
        <div className="h-72">
          {planNames.length ? (
            <ResponsiveContainer>
              <BarChart data={stackedByPlan}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip {...chartTooltip} formatter={(v: number) => formatBRL(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {planNames.map((p, i) => (
                  <Bar key={p} dataKey={p} stackId="a" fill={colors[i % colors.length]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState title="Sem pagamentos no ano" />}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plano</TableHead>
              <TableHead className="text-right">Alunos</TableHead>
              <TableHead className="text-right">Receita</TableHead>
              <TableHead className="text-right">Ticket Médio</TableHead>
              <TableHead className="text-right">% Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {planTable.map((r) => (
              <TableRow key={r.name}>
                <TableCell>{r.name}</TableCell>
                <TableCell className="text-right font-mono">{r.students}</TableCell>
                <TableCell className="text-right font-mono">{formatBRL(r.rev)}</TableCell>
                <TableCell className="text-right font-mono">{formatBRL(r.avg)}</TableCell>
                <TableCell className="text-right font-mono">{r.pct.toFixed(1)}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>

      <Section title="Formas de pagamento">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-64">
            {byMethod.length ? (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={byMethod} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>
                    {byMethod.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                  </Pie>
                  <Tooltip {...chartTooltip} formatter={(v: number) => formatBRL(v)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <EmptyState title="Sem dados" />}
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={methodTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip {...chartTooltip} formatter={(v: number) => formatBRL(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {["PIX","Cartão de Crédito","Boleto"].map((m, i) => (
                  <Area key={m} type="monotone" dataKey={m} stackId="1" stroke={colors[i]} fill={colors[i]} fillOpacity={0.5} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Section>
    </div>
  );
}
