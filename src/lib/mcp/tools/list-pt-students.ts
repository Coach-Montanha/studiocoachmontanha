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
  name: "list_pt_students",
  title: "Listar alunos de Personal Trainer",
  description:
    "Lista os alunos de Personal Trainer (PT) do usuário autenticado. Suporta filtro por status e busca por nome/email.",
  inputSchema: {
    status: z.enum(["active", "inactive", "churned"]).optional(),
    search: z.string().trim().optional().describe("Busca no nome ou email"),
    limit: z.number().int().min(1).max(200).default(50),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, search, limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    let q = supabaseForUser(ctx)
      .from("pt_students")
      .select("id,name,email,phone,status,goal,start_date,created_at")
      .is("deleted_at", null)
      .order("name")
      .limit(limit);
    if (status) q = q.eq("status", status);
    if (search) q = q.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { students: data ?? [] },
    };
  },
});
