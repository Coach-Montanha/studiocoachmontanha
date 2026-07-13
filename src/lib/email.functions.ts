import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type EmailSettings = {
  hasKey: boolean;
  senderEmail: string | null;
};

export const getEmailSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EmailSettings> => {
    const { data, error } = await context.supabase
      .from("user_email_settings")
      .select("resend_api_key, sender_email")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      hasKey: !!data?.resend_api_key,
      senderEmail: data?.sender_email ?? null,
    };
  });

export const saveEmailSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { resendApiKey?: string | null; senderEmail?: string | null }) => ({
    resendApiKey: input.resendApiKey ?? null,
    senderEmail: input.senderEmail ?? null,
  }))
  .handler(async ({ data, context }) => {
    const payload: {
      user_id: string;
      sender_email: string | null;
      resend_api_key?: string;
    } = {
      user_id: context.userId,
      sender_email: data.senderEmail,
    };
    // Only overwrite the API key when a non-empty value is provided,
    // so users can update the sender email without re-typing the key.
    if (data.resendApiKey && data.resendApiKey.trim().length > 0) {
      payload.resend_api_key = data.resendApiKey.trim();
    }
    const { error } = await context.supabase
      .from("user_email_settings")
      .upsert(payload, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { to: string; subject: string; text: string }) => {
      if (!input.to || !input.to.includes("@")) throw new Error("Destinatário inválido");
      if (!input.text || input.text.trim().length === 0) throw new Error("Mensagem vazia");
      return {
        to: input.to,
        subject: input.subject || "Mensagem da sua academia",
        text: input.text,
      };
    },
  )
  .handler(async ({ data, context }) => {
    const { data: settings, error } = await context.supabase
      .from("user_email_settings")
      .select("resend_api_key, sender_email")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const apiKey = settings?.resend_api_key || process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("Configure sua API key Resend em Configurações.");
    }
    const from = settings?.sender_email || "noreply@seudominio.com";

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: [data.to],
        subject: data.subject,
        text: data.text,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Resend ${res.status}: ${body.slice(0, 200)}`);
    }
    return { ok: true };
  });
