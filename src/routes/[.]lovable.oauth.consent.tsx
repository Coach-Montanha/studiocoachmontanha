import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

// Minimal typed shim for the beta `supabase.auth.oauth` namespace.
type AuthorizationDetails = {
  client?: { name?: string; client_uri?: string } | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
  scope?: string | null;
};
type OAuthNs = {
  getAuthorizationDetails(id: string): Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  approveAuthorization(id: string): Promise<{ data: { redirect_url?: string | null; redirect_to?: string | null } | null; error: { message: string } | null }>;
  denyAuthorization(id: string): Promise<{ data: { redirect_url?: string | null; redirect_to?: string | null } | null; error: { message: string } | null }>;
};
const oauth = (supabase.auth as unknown as { oauth: OAuthNs }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("authorization_id ausente");
    const { data } = await supabase.auth.getSession();
    const next = location.pathname + location.searchStr;
    if (!data.session) throw redirect({ to: "/auth", search: { next } });
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="mx-auto max-w-md p-6">
      <Card className="p-6">
        <h1 className="text-lg font-semibold">Não foi possível carregar a autorização</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {String((error as Error)?.message ?? error)}
        </p>
      </Card>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState<"approve" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const clientName = details?.client?.name ?? "esse aplicativo";

  async function decide(approve: boolean) {
    setBusy(approve ? "approve" : "deny");
    setError(null);
    const { data, error } = approve
      ? await oauth.approveAuthorization(authorization_id)
      : await oauth.denyAuthorization(authorization_id);
    if (error) {
      setBusy(null);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(null);
      setError("O servidor de autorização não retornou uma URL de redirecionamento.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center p-6">
      <Card className="w-full space-y-4 p-6">
        <div>
          <h1 className="text-xl font-semibold">
            Conectar {clientName} à sua conta
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Isto permite que <strong>{clientName}</strong> use este app como você,
            acessando somente os seus alunos, pagamentos e resumos financeiros.
            As permissões do app e as políticas do banco continuam valendo.
          </p>
        </div>
        {details?.client?.client_uri && (
          <p className="text-xs text-muted-foreground">
            Origem do cliente: {details.client.client_uri}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Button onClick={() => decide(true)} disabled={busy !== null} className="sm:flex-1">
            {busy === "approve" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Aprovar e conectar
          </Button>
          <Button
            variant="outline"
            onClick={() => decide(false)}
            disabled={busy !== null}
            className="sm:flex-1"
          >
            {busy === "deny" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Cancelar conexão
          </Button>
        </div>
      </Card>
    </main>
  );
}
