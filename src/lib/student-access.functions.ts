import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Admin cria a conta de login para um aluno já cadastrado.
 * Retorna a senha temporária gerada.
 */
export const createStudentAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { studentId: string; email: string }) => {
      if (!input.studentId) throw new Error("studentId requerido");
      if (!input.email || !input.email.includes("@")) throw new Error("email inválido");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Somente administradores");

    const { data: student, error: sErr } = await supabase
      .from("students")
      .select("id, user_id, account_user_id, name")
      .eq("id", data.studentId)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!student) throw new Error("Aluno não encontrado");
    if (student.user_id !== userId) throw new Error("Aluno não pertence a este studio");
    if (student.account_user_id) throw new Error("Este aluno já tem acesso");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Gera senha temporária
    const tempPassword = String(Math.floor(1000 + Math.random() * 9000));

    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { student_name: student.name },
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
      .from("students")
      .update({ account_user_id: authUserId })
      .eq("id", data.studentId);
    if (linkErr) {
      await supabaseAdmin.auth.admin.deleteUser(authUserId);
      throw new Error(linkErr.message);
    }

    return { email: data.email, tempPassword };
  });
