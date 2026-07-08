import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const sendInAppNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { studentIds: string[]; title: string; body: string }) => {
    if (!Array.isArray(input.studentIds) || input.studentIds.length === 0)
      throw new Error("Selecione ao menos um aluno");
    if (!input.title?.trim()) throw new Error("Título obrigatório");
    if (!input.body?.trim()) throw new Error("Mensagem obrigatória");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: students, error } = await supabase
      .from("students")
      .select("id, name, account_user_id")
      .in("id", data.studentIds)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);

    const withAccount = (students ?? []).filter((s) => s.account_user_id);
    const withoutAccount = (students ?? []).filter((s) => !s.account_user_id);

    if (withAccount.length === 0) {
      return { sent: 0, skipped: withoutAccount.map((s) => s.name) };
    }

    const rows = withAccount.map((s) => ({
      recipient_user_id: s.account_user_id!,
      sender_user_id: userId,
      title: data.title.trim(),
      body: data.body.trim(),
    }));

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: iErr } = await supabaseAdmin.from("notifications").insert(rows);
    if (iErr) throw new Error(iErr.message);

    return { sent: withAccount.length, skipped: withoutAccount.map((s) => s.name) };
  });
