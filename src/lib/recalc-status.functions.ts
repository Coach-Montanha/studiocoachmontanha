import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const recalcAllStudentStatuses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("recalculate_all_student_statuses_for", {
      p_user_id: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const recalcAllPtStudentStatuses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("recalculate_all_pt_student_statuses_for", {
      p_user_id: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
