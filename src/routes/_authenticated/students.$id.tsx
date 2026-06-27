import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Plus, CalendarDays, Wallet, Receipt, TrendingUp } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { KPICard } from "@/components/edufinance/KPICard";
import { PaymentStatusBadge, PlanBadge, StudentStatusBadge } from "@/components/edufinance/Badges";
import { EmptyState } from "@/components/edufinance/EmptyState";
import { PaymentDialog } from "@/components/edufinance/PaymentDialog";
import { formatBRL, formatDateBR, formatMonthLabel, initials, paymentMethodLabel } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/students/$id")({
  head: () => ({ meta: [{ title: "Aluno — EduFinance" }] }),
  component: StudentDetail,
});

function StudentDetail() {
  const { id } = Route.useParams();
  const [open, setOpen] = useState(false);

  const { data: student } = useQuery({
    queryKey: ["student", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id,name,email,phone,status,notes,created_at,student_plan_history(id,start_date,end_date,is_current,plans(name))")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["student-payments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("id,amount,payment_date,reference_month,payment_method,status,plans(name)")
        .eq("student_id", id)
        .order("payment_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const k = useMemo(() => {
    const paid = payments.filter((p) => p.status === "paid");
    const total = paid.reduce((s, p) => s + Number(p.amount), 0);
    const months = new Set(paid.map((p) => p.reference_month)).size;
    const avg = paid.length ? total / paid.length : 0;
    const last = paid[0]?.payment_date;
    return { total, months, avg, last };
  }, [payments]);

  if (!student) {
    return <div className="text-sm text-muted-foreground">Carregando…</div>;
  }

  const currentPlan = student.student_plan_history?.find((h) => h.is_current);

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
          </div>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Novo pagamento
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard label="LTV (Total pago)" value={formatBRL(k.total)} icon={<Wallet className="h-5 w-5" />} />
        <KPICard label="Meses ativos" value={k.months} icon={<CalendarDays className="h-5 w-5" />} />
        <KPICard label="Ticket médio" value={formatBRL(k.avg)} icon={<TrendingUp className="h-5 w-5" />} />
        <KPICard label="Último pagamento" value={k.last ? formatDateBR(k.last) : "—"} icon={<Receipt className="h-5 w-5" />} />
      </div>

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold">Histórico de pagamentos</h2>
        {payments.length === 0 ? (
          <EmptyState title="Sem pagamentos" description="Registre o primeiro pagamento" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês ref.</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Método</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-xs uppercase font-mono">{formatMonthLabel(p.reference_month)}</TableCell>
                  <TableCell className="text-xs font-mono">{formatDateBR(p.payment_date)}</TableCell>
                  <TableCell><PlanBadge name={p.plans?.name} /></TableCell>
                  <TableCell className="text-xs">{paymentMethodLabel(p.payment_method)}</TableCell>
                  <TableCell className="text-right font-mono font-medium">{formatBRL(p.amount)}</TableCell>
                  <TableCell><PaymentStatusBadge status={p.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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

      <PaymentDialog open={open} onOpenChange={setOpen} defaultStudentId={id} />
    </div>
  );
}
