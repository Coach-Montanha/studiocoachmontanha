import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type StorageEntry = {
  name: string;
  path: string;
  size: number | null;
  updated_at: string | null;
  mimetype: string | null;
};

const BUCKETS = ["announcements", "avatars", "contracts", "exercise-media"] as const;
export type StorageBucketId = (typeof BUCKETS)[number];

export const listMyBuckets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return BUCKETS.map((id) => ({ id, label: labelFor(id) }));
  });

function labelFor(b: StorageBucketId) {
  switch (b) {
    case "announcements":
      return "Avisos e imagens IA";
    case "avatars":
      return "Fotos de alunos";
    case "contracts":
      return "Contratos (PDF)";
    case "exercise-media":
      return "Mídia de exercícios";
  }
}

export const listMyBucketFiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { bucket: StorageBucketId; prefix?: string }) => {
    if (!BUCKETS.includes(input.bucket)) throw new Error("Bucket inválido");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const basePrefix = data.prefix ? `${userId}/${data.prefix}` : `${userId}`;

    async function walk(prefix: string, depth: number): Promise<StorageEntry[]> {
      if (depth > 3) return [];
      const { data: rows, error } = await supabaseAdmin.storage
        .from(data.bucket)
        .list(prefix, { limit: 200, sortBy: { column: "updated_at", order: "desc" } });
      if (error) return [];
      const out: StorageEntry[] = [];
      for (const r of rows ?? []) {
        const isFolder = !(r as any).id; // folder placeholders have null id
        const p = `${prefix}/${r.name}`;
        if (isFolder) {
          out.push(...(await walk(p, depth + 1)));
        } else {
          out.push({
            name: r.name,
            path: p,
            size: (r.metadata as any)?.size ?? null,
            updated_at: r.updated_at ?? r.created_at ?? null,
            mimetype: (r.metadata as any)?.mimetype ?? null,
          });
        }
      }
      return out;
    }

    const files = await walk(basePrefix, 0);
    return files.slice(0, 300);
  });

export const signMyBucketFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { bucket: StorageBucketId; path: string }) => {
    if (!BUCKETS.includes(input.bucket)) throw new Error("Bucket inválido");
    if (!input.path) throw new Error("path requerido");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { userId } = context;
    if (!data.path.startsWith(`${userId}/`)) throw new Error("Acesso negado");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from(data.bucket)
      .createSignedUrl(data.path, 60 * 60);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });

export const deleteMyBucketFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { bucket: StorageBucketId; path: string }) => {
    if (!BUCKETS.includes(input.bucket)) throw new Error("Bucket inválido");
    if (!input.path) throw new Error("path requerido");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { userId } = context;
    if (!data.path.startsWith(`${userId}/`)) throw new Error("Acesso negado");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.storage.from(data.bucket).remove([data.path]);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
