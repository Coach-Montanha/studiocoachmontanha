import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createHash } from "crypto";

export type AiImageModel = "google/gemini-3.1-flash-image" | "google/gemini-3-pro-image";
export type AiImageCacheRow = {
  id: string;
  prompt: string;
  model: string;
  aspect: string;
  image_path: string;
  created_at: string;
};

function hashKey(model: string, aspect: string, prompt: string) {
  return createHash("sha256")
    .update(`${model}|${aspect}|${prompt.trim().toLowerCase()}`)
    .digest("hex");
}

function extForAspect(_aspect: string) {
  return "png";
}

export const generateAnnouncementImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      prompt: string;
      aspect: string; // "1:1" | "16:9" | "9:16" | "4:3" | "3:4" | "custom:WxH"
      model?: AiImageModel;
    }) => {
      const p = (input.prompt ?? "").trim();
      if (p.length < 3) throw new Error("Descreva a imagem (mínimo 3 caracteres)");
      if (p.length > 2000) throw new Error("Prompt muito longo (máx 2000 caracteres)");
      const aspect = input.aspect || "1:1";
      const model: AiImageModel =
        input.model === "google/gemini-3-pro-image"
          ? "google/gemini-3-pro-image"
          : "google/gemini-3.1-flash-image";
      return { prompt: p, aspect, model };
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1) Cache hit → reutiliza (não consome créditos)
    const key = hashKey(data.model, data.aspect, data.prompt);
    const { data: hit } = await supabase
      .from("ai_image_cache" as never)
      .select("id,prompt,model,aspect,image_path,created_at")
      .eq("user_id", userId)
      .eq("prompt_hash", key)
      .maybeSingle();
    if (hit) {
      return { path: (hit as any).image_path as string, cached: true };
    }

    // 2) Chama Lovable AI Gateway (Gemini image, chat-shape)
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");

    const aspectHint =
      data.aspect === "custom"
        ? ""
        : `Formato/proporção da imagem: ${data.aspect.replace("custom:", "")}. Componha o enquadramento respeitando essa proporção.`;
    const userPrompt = `${data.prompt}\n\n${aspectHint}\nEstilo limpo, alta qualidade, adequado para um aviso publicado em app fitness/estúdio.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: data.model,
        messages: [{ role: "user", content: userPrompt }],
        modalities: ["image", "text"],
      }),
    });
    if (res.status === 429) throw new Error("Limite de uso da IA atingido. Tente novamente em alguns instantes.");
    if (res.status === 402) throw new Error("Créditos da IA esgotados. Adicione créditos no workspace.");
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Falha na geração de imagem (${res.status}): ${t.slice(0, 200)}`);
    }
    const json = (await res.json()) as any;
    const b64: string | undefined = json?.data?.[0]?.b64_json;
    if (!b64) throw new Error("A IA não retornou uma imagem.");

    // 3) Upload no bucket announcements: {userId}/ai/{hash}.png
    const buffer = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const path = `${userId}/ai/${key}.${extForAspect(data.aspect)}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: upErr } = await supabaseAdmin.storage
      .from("announcements")
      .upload(path, buffer, { contentType: "image/png", upsert: true });
    if (upErr) throw new Error(upErr.message);

    // 4) Registra no cache
    const { error: cErr } = await supabase
      .from("ai_image_cache" as never)
      .insert({
        user_id: userId,
        prompt_hash: key,
        prompt: data.prompt,
        model: data.model,
        aspect: data.aspect,
        image_path: path,
      } as never);
    if (cErr && !/duplicate key/i.test(cErr.message)) throw new Error(cErr.message);

    return { path, cached: false };
  });

export const listAiImageCache = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("ai_image_cache" as never)
      .select("id,prompt,model,aspect,image_path,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);
    return (data ?? []) as AiImageCacheRow[];
  });

export const deleteAiImageCache = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input.id) throw new Error("id requerido");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("ai_image_cache" as never)
      .select("image_path")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    const { error } = await supabase
      .from("ai_image_cache" as never)
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    if (row) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.storage.from("announcements").remove([(row as any).image_path]);
    }
    return { ok: true };
  });
