import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MODULES = ["studio", "pt", "financeiro", "crm"] as const;
type Module = (typeof MODULES)[number];

async function assertSuperAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("is_super_admin", {
    _user_id: context.userId,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Somente super admin");
}

/**
 * Lista todos os treinadores (usuários com papel `admin`) com seus módulos.
 * Super admin apenas.
 */
export const listTenants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: roles, error: rErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");
    if (rErr) throw new Error(rErr.message);

    const adminIds = Array.from(
      new Set(
        (roles ?? [])
          .filter((r) => r.role === "admin" || r.role === "super_admin")
          .map((r) => r.user_id as string),
      ),
    );
    if (adminIds.length === 0) return [];

    const { data: usersList, error: uErr } =
      await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (uErr) throw new Error(uErr.message);

    const { data: mods, error: mErr } = await supabaseAdmin
      .from("user_modules")
      .select("user_id, module, active, expires_at")
      .in("user_id", adminIds);
    if (mErr) throw new Error(mErr.message);

    const rolesByUser = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const arr = rolesByUser.get(r.user_id as string) ?? [];
      arr.push(r.role as string);
      rolesByUser.set(r.user_id as string, arr);
    }

    const modsByUser = new Map<
      string,
      { module: Module; active: boolean; expires_at: string | null }[]
    >();
    for (const m of mods ?? []) {
      const arr = modsByUser.get(m.user_id as string) ?? [];
      arr.push({
        module: m.module as Module,
        active: m.active as boolean,
        expires_at: (m.expires_at as string | null) ?? null,
      });
      modsByUser.set(m.user_id as string, arr);
    }

    return adminIds.map((id) => {
      const u = usersList.users.find((x) => x.id === id);
      return {
        userId: id,
        email: u?.email ?? "(sem email)",
        createdAt: u?.created_at ?? null,
        roles: rolesByUser.get(id) ?? [],
        modules: modsByUser.get(id) ?? [],
      };
    });
  });

/**
 * Cria uma nova conta de treinador (papel `admin`) com senha temporária.
 * Super admin apenas.
 */
export const createTrainer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; modules: Module[] }) => {
    if (!input.email || !input.email.includes("@"))
      throw new Error("email inválido");
    if (!Array.isArray(input.modules)) throw new Error("modules inválido");
    for (const m of input.modules) {
      if (!MODULES.includes(m)) throw new Error(`módulo inválido: ${m}`);
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { randomInt } = require("crypto") as typeof import("crypto");
    const gen = () => {
      while (true) {
        let s = "";
        for (let i = 0; i < 10; i++) s += randomInt(0, 10).toString();
        if (/^(\d)\1+$/.test(s)) continue;
        return s;
      }
    };
    const isWeak = (msg: string) => /weak|pwned|known|easy to guess/i.test(msg);

    let tempPassword = gen();
    let created: Awaited<ReturnType<typeof supabaseAdmin.auth.admin.createUser>>["data"] | null = null;
    let lastErr: string | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const res = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: tempPassword,
        email_confirm: true,
      });
      if (!res.error && res.data.user) { created = res.data; lastErr = null; break; }
      lastErr = res.error?.message || "Falha ao criar usuário";
      if (!res.error || !isWeak(res.error.message)) throw new Error(lastErr);
      tempPassword = gen();
    }
    if (!created) throw new Error(lastErr || "Falha ao criar usuário");
    const newUserId = created.user!.id;

    const { error: rErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newUserId, role: "admin" });
    if (rErr) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw new Error(rErr.message);
    }

    if (data.modules.length > 0) {
      const rows = data.modules.map((m) => ({
        user_id: newUserId,
        module: m,
        active: true,
      }));
      const { error: mErr } = await supabaseAdmin.from("user_modules").insert(rows);
      if (mErr) {
        await supabaseAdmin.auth.admin.deleteUser(newUserId);
        throw new Error(mErr.message);
      }
    }

    return { userId: newUserId, email: data.email, tempPassword };
  });

/**
 * Ativa/desativa/define validade de um módulo para um treinador.
 * Super admin apenas.
 */
export const setTenantModule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      userId: string;
      module: Module;
      active: boolean;
      expiresAt: string | null;
    }) => {
      if (!input.userId) throw new Error("userId requerido");
      if (!MODULES.includes(input.module))
        throw new Error(`módulo inválido: ${input.module}`);
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_modules")
      .upsert(
        {
          user_id: data.userId,
          module: data.module,
          active: data.active,
          expires_at: data.expiresAt,
        },
        { onConflict: "user_id,module" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Redefine a senha de um treinador (super admin).
 */
export const resetTrainerPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => {
    if (!input.userId) throw new Error("userId requerido");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { randomInt } = require("crypto") as typeof import("crypto");
    const gen = () => {
      let s = "";
      for (let i = 0; i < 10; i++) s += randomInt(0, 10).toString();
      return s;
    };
    const tempPassword = gen();
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: tempPassword,
    });
    if (error) throw new Error(error.message);
    return { tempPassword };
  });
