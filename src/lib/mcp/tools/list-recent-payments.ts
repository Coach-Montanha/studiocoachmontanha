import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_recent_payments",
  title: "Listar pagamentos recentes",
  description:
    "Lista pagamentos recentes do módulo Studio ou PT do usuário autenticado. Suporta filtro por status (paid, pending, overdue).",
  inputSchema: {
    module: z.enum(["studio", "pt"]).default("studio"),
    status: z.enum(["paid", "pending", "overdue"]).optional(),
    limit: z.number().int().min(1).max(200).default(50),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ module, status, limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    const sb = supabaseForUser(ctx);
    const table = module === "pt" ? "pt_payments" : "payments";
    let q = sb
      .from(table)
      .select("id,amount,status,payment_date,due_date,reference_month,payment_method")
      .is("deleted_at", null)
      .order("payment_date", { ascending: false, nullsFirst: false })
      .order("due_date", { ascending: false, nullsFirst: false })
      .limit(limit);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { payments: data ?? [] },
    };
  },
});
