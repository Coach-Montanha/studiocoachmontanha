import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "financial_overview",
  title: "Resumo financeiro",
  description:
    "Retorna um resumo financeiro do usuário autenticado: total de alunos ativos (Studio e PT), pagamentos pendentes/atrasados e receita paga do mês corrente.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    const sb = supabaseForUser(ctx);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

    const [studioActive, ptActive, studioPend, ptPend, studioPaid, ptPaid] = await Promise.all([
      sb.from("students").select("id", { count: "exact", head: true }).is("deleted_at", null).eq("status", "active"),
      sb.from("pt_students").select("id", { count: "exact", head: true }).is("deleted_at", null).eq("status", "active"),
      sb.from("payments").select("amount,status").is("deleted_at", null).in("status", ["pending", "overdue"]),
      sb.from("pt_payments").select("amount,status").is("deleted_at", null).in("status", ["pending", "overdue"]),
      sb.from("payments").select("amount").is("deleted_at", null).eq("status", "paid").gte("payment_date", monthStart).lte("payment_date", monthEnd),
      sb.from("pt_payments").select("amount").is("deleted_at", null).eq("status", "paid").gte("payment_date", monthStart).lte("payment_date", monthEnd),
    ]);

    const sum = (rows: { amount: number | null }[] | null | undefined) =>
      (rows ?? []).reduce((a, r) => a + (Number(r.amount) || 0), 0);

    const overview = {
      month: monthStart.slice(0, 7),
      studio: {
        active_students: studioActive.count ?? 0,
        pending_amount: sum((studioPend.data ?? []).filter((r) => r.status === "pending")),
        overdue_amount: sum((studioPend.data ?? []).filter((r) => r.status === "overdue")),
        month_paid: sum(studioPaid.data),
      },
      pt: {
        active_students: ptActive.count ?? 0,
        pending_amount: sum((ptPend.data ?? []).filter((r) => r.status === "pending")),
        overdue_amount: sum((ptPend.data ?? []).filter((r) => r.status === "overdue")),
        month_paid: sum(ptPaid.data),
      },
    };
    return {
      content: [{ type: "text", text: JSON.stringify(overview) }],
      structuredContent: overview,
    };
  },
});
