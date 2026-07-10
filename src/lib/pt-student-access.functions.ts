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

    const generateNumericPassword = () => {
      const { randomInt } = require("crypto") as typeof import("crypto");
      // 12 dígitos aleatórios — evita padrões triviais e HIBP.
      while (true) {
        let s = "";
        for (let i = 0; i < 12; i++) s += randomInt(0, 10).toString();
        if (/^(\d)\1+$/.test(s)) continue; // todos iguais
        if (s === "012345678901" || s === "123456789012") continue;
        return s;
      }
    };

    const isWeak = (msg: string) =>
      /weak|pwned|known|easy to guess/i.test(msg);

    let tempPassword = generateNumericPassword();

    if (student.account_user_id) {
      let lastErr: string | null = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const { error: uErr } = await supabaseAdmin.auth.admin.updateUserById(
          student.account_user_id,
          { password: tempPassword, email: data.email },
        );
        if (!uErr) { lastErr = null; break; }
        lastErr = uErr.message;
        if (!isWeak(uErr.message)) throw new Error(uErr.message);
        tempPassword = generateNumericPassword();
      }
      if (lastErr) throw new Error(lastErr);

      const { error: sUpdErr } = await supabaseAdmin
        .from("pt_students")
        .update({ temp_password: tempPassword, email: data.email })
        .eq("id", data.studentId);
      if (sUpdErr) throw new Error(sUpdErr.message);

      return { email: data.email, tempPassword, reset: true };
    }

    let created: Awaited<ReturnType<typeof supabaseAdmin.auth.admin.createUser>>["data"] | null = null;
    {
      let lastErr: string | null = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const res = await supabaseAdmin.auth.admin.createUser({
          email: data.email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { student_name: student.name, kind: "pt" },
        });
        if (!res.error && res.data.user) { created = res.data; lastErr = null; break; }
        lastErr = res.error?.message || "Falha ao criar usuário";
        if (!res.error || !isWeak(res.error.message)) throw new Error(lastErr);
        tempPassword = generateNumericPassword();
      }
      if (!created) throw new Error(lastErr || "Falha ao criar usuário");
    }

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
