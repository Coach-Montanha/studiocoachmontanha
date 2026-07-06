import { supabase } from "@/integrations/supabase/client";

export async function generateMonthlyReport(referenceMonth: string): Promise<string> {
  const [year, month] = referenceMonth.split("-").map(Number);
  const monthLabel = new Date(year, month - 1, 1)
    .toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const { data: payments } = await supabase
    .from("payments")
    .select("amount,status,students(name),plans(name)")
    .eq("reference_month", referenceMonth);

  const paid = (payments ?? []).filter((p: any) => p.status === "paid");
  const pending = (payments ?? []).filter((p: any) => p.status === "pending");
  const overdue = (payments ?? []).filter((p: any) => p.status === "overdue");

  const totalPaid = paid.reduce((s: number, p: any) => s + Number(p.amount), 0);
  const totalPending = pending.reduce((s: number, p: any) => s + Number(p.amount), 0);
  const totalOverdue = overdue.reduce((s: number, p: any) => s + Number(p.amount), 0);
  const avgTicket = paid.length ? totalPaid / paid.length : 0;

  const { count: activeStudents } = await supabase
    .from("students")
    .select("*", { count: "exact", head: true })
    .eq("status", "active");

  const prevMonth = month === 1
    ? `${year - 1}-12`
    : `${year}-${String(month - 1).padStart(2, "0")}`;

  const { data: paidLastMonth } = await supabase
    .from("payments")
    .select("student_id")
    .eq("reference_month", prevMonth)
    .eq("status", "paid");

  const { data: paidThisMonth } = await supabase
    .from("payments")
    .select("student_id")
    .eq("reference_month", referenceMonth)
    .eq("status", "paid");

  const thisMonthSet = new Set((paidThisMonth ?? []).map((p: any) => p.student_id));
  const churnCount = (paidLastMonth ?? []).filter(
    (p: any) => !thisMonthSet.has(p.student_id)
  ).length;

  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 640px; margin: 0 auto; background: #f8fafc; padding: 24px;">
  <div style="background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
    <h1 style="margin: 0 0 4px; font-size: 24px; color: #0f172a;">📊 Relatório Mensal</h1>
    <p style="margin: 0 0 24px; color: #64748b; text-transform: capitalize;">${monthLabel}</p>

    <h2 style="margin: 24px 0 12px; font-size: 16px; color: #0f172a;">💰 Receita</h2>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 12px; background: #f1f5f9; border-radius: 8px; width: 33%;">
          <div style="font-size: 11px; color: #64748b; text-transform: uppercase;">Total Recebido</div>
          <div style="font-size: 20px; font-weight: 600; color: #16a34a;">${fmt(totalPaid)}</div>
        </td>
        <td style="padding: 12px; background: #f1f5f9; border-radius: 8px; width: 33%;">
          <div style="font-size: 11px; color: #64748b; text-transform: uppercase;">Ticket Médio</div>
          <div style="font-size: 20px; font-weight: 600; color: #0f172a;">${fmt(avgTicket)}</div>
        </td>
        <td style="padding: 12px; background: #f1f5f9; border-radius: 8px; width: 33%;">
          <div style="font-size: 11px; color: #64748b; text-transform: uppercase;">Pagamentos</div>
          <div style="font-size: 20px; font-weight: 600; color: #0f172a;">${paid.length}</div>
        </td>
      </tr>
    </table>

    <h2 style="margin: 24px 0 12px; font-size: 16px; color: #0f172a;">👥 Alunos</h2>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 12px; background: #f1f5f9; border-radius: 8px; width: 33%;">
          <div style="font-size: 11px; color: #64748b; text-transform: uppercase;">Alunos Ativos</div>
          <div style="font-size: 20px; font-weight: 600; color: #0f172a;">${activeStudents ?? 0}</div>
        </td>
        <td style="padding: 12px; background: #f1f5f9; border-radius: 8px; width: 33%;">
          <div style="font-size: 11px; color: #64748b; text-transform: uppercase;">Churn no Mês</div>
          <div style="font-size: 20px; font-weight: 600; color: #dc2626;">${churnCount}</div>
        </td>
        <td style="padding: 12px; background: #f1f5f9; border-radius: 8px; width: 33%;">
          <div style="font-size: 11px; color: #64748b; text-transform: uppercase;">Pendentes</div>
          <div style="font-size: 20px; font-weight: 600; color: #ca8a04;">${fmt(totalPending)}</div>
        </td>
      </tr>
    </table>

    ${overdue.length > 0 ? `
    <div style="margin-top: 24px; padding: 16px; background: #fef2f2; border-left: 4px solid #dc2626; border-radius: 8px;">
      <div style="font-weight: 600; color: #b91c1c;">⚠️ ${overdue.length} pagamento(s) em atraso — ${fmt(totalOverdue)}</div>
    </div>
    ` : ""}

    <p style="margin-top: 32px; font-size: 11px; color: #94a3b8; text-align: center;">
      Relatório gerado automaticamente pelo EduFinance
    </p>
  </div>
</div>
  `.trim();
}
