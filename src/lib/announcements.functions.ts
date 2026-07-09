import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AnnouncementRow = {
  id: string;
  title: string | null;
  body: string | null;
  image_url: string | null;
  starts_at: string;
  ends_at: string;
  active: boolean;
  created_at: string;
};

export const listMyAnnouncements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("announcements")
      .select("id,title,body,image_url,starts_at,ends_at,active,created_at")
      .eq("user_id", userId)
      .order("starts_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as AnnouncementRow[];
  });

export const upsertAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id?: string;
      title?: string | null;
      body?: string | null;
      image_url?: string | null;
      starts_at: string;
      ends_at: string;
      active?: boolean;
    }) => {
      if (!input.starts_at || !input.ends_at) throw new Error("Datas obrigatórias");
      if (new Date(input.ends_at) <= new Date(input.starts_at)) {
        throw new Error("Fim deve ser depois do início");
      }
      if (!input.title && !input.body && !input.image_url) {
        throw new Error("Informe texto ou imagem");
      }
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload = {
      user_id: userId,
      title: data.title ?? null,
      body: data.body ?? null,
      image_url: data.image_url ?? null,
      starts_at: data.starts_at,
      ends_at: data.ends_at,
      active: data.active ?? true,
    };
    if (data.id) {
      const { error } = await supabase
        .from("announcements")
        .update(payload)
        .eq("id", data.id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: inserted, error } = await supabase
      .from("announcements")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted!.id };
  });

export const deleteAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input.id) throw new Error("id requerido");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("announcements")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getSignedAnnouncementImageUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { path: string }) => {
    if (!input.path) throw new Error("path requerido");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: signed, error } = await supabase.storage
      .from("announcements")
      .createSignedUrl(data.path, 60 * 60 * 24);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });

/**
 * Portal: retorna avisos ativos (na janela) do studio do aluno logado.
 * Descobre o dono do studio via students.user_id.
 */
export const getActiveAnnouncementsForPortal = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    // Descobre o(s) owner(s) via matrículas do aluno
    const { data: st } = await supabase
      .from("students")
      .select("user_id")
      .eq("account_user_id", userId);
    const ownerIds = Array.from(new Set((st ?? []).map((s) => s.user_id).filter(Boolean)));
    // Também tenta PT
    const { data: ptSt } = await supabase
      .from("pt_students")
      .select("user_id")
      .eq("account_user_id", userId);
    for (const s of ptSt ?? []) if (s.user_id && !ownerIds.includes(s.user_id)) ownerIds.push(s.user_id);
    if (ownerIds.length === 0) return [] as AnnouncementRow[];

    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from("announcements")
      .select("id,title,body,image_url,starts_at,ends_at,active,created_at")
      .in("user_id", ownerIds)
      .eq("active", true)
      .lte("starts_at", nowIso)
      .gte("ends_at", nowIso)
      .order("starts_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as AnnouncementRow[];
  });
