import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Admin cria (ou redefine) a conta de login para um aluno de Personal Trainer.
 * Retorna a senha temporária gerada.
 */
export const createPTStudentAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { studentId: string; email: string }) => {
    if (!input.studentId) throw new Error("studentId requerido");
    if (!input.email || !input.email.includes("@")) throw new Error("email inválido");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Somente administradores");

    const { data: student, error: sErr } = await supabase
      .from("pt_students")
      .select("id, user_id, account_user_id, name")
      .eq("id", data.studentId)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!student) throw new Error("Aluno não encontrado");
    if (student.user_id !== userId) throw new Error("Aluno não pertence a este trainer");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const tempPassword = String(Math.floor(100000 + Math.random() * 900000));

    if (student.account_user_id) {
      const { error: uErr } = await supabaseAdmin.auth.admin.updateUserById(
        student.account_user_id,
        { password: tempPassword, email: data.email },
      );
      if (uErr) throw new Error(uErr.message);

      const { error: sUpdErr } = await supabaseAdmin
        .from("pt_students")
        .update({ temp_password: tempPassword, email: data.email })
        .eq("id", data.studentId);
      if (sUpdErr) throw new Error(sUpdErr.message);

      return { email: data.email, tempPassword, reset: true };
    }

    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { student_name: student.name, kind: "pt" },
    });
    if (cErr || !created.user) throw new Error(cErr?.message || "Falha ao criar usuário");

    const authUserId = created.user.id;

    const { error: rErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: authUserId, role: "student" });
    if (rErr) {
      await supabaseAdmin.auth.admin.deleteUser(authUserId);
      throw new Error(rErr.message);
    }

    const { error: linkErr } = await supabaseAdmin
      .from("pt_students")
      .update({ account_user_id: authUserId, temp_password: tempPassword, email: data.email })
      .eq("id", data.studentId);
    if (linkErr) {
      await supabaseAdmin.auth.admin.deleteUser(authUserId);
      throw new Error(linkErr.message);
    }

    return { email: data.email, tempPassword, reset: false };
  });
