import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { formatBRL, formatDateBR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/portal/plano")({
  head: () => ({ meta: [{ title: "Meu plano" }] }),
  component: PlanoPage,
});

function PlanoPage() {
  const { data: me } = useQuery({
    queryKey: ["portal-me-id"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase
        .from("students")
        .select("id")
        .eq("account_user_id", u.user.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["portal-plan-history", me?.id],
    enabled: !!me?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("student_plan_history")
        .select("id,start_date,end_date,is_current,plans(name,price,billing_cycle,description)")
        .eq("student_id", me!.id)
        .order("start_date", { ascending: false });
      return (data ?? []) as any[];
    },
  });

  const current = history.find((h) => h.is_current);

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Meu plano</h1>

      {current ? (
        <Card className="p-6 border-primary/40">
          <div className="text-xs uppercase text-primary font-medium">Plano ativo</div>
          <div className="mt-1 text-2xl font-bold">{current.plans?.name}</div>
          <div className="text-lg text-muted-foreground">
            {formatBRL(Number(current.plans?.price ?? 0))} / {current.plans?.billing_cycle ?? "mês"}
          </div>
          {current.plans?.description && (
            <p className="mt-3 text-sm">{current.plans.description}</p>
          )}
          <div className="mt-3 text-xs text-muted-foreground">
            Desde {formatDateBR(current.start_date)}
          </div>
        </Card>
      ) : (
        <Card className="p-6 text-sm text-muted-foreground">Sem plano ativo</Card>
      )}

      <div>
        <h2 className="text-sm font-semibold mb-2">Histórico</h2>
        {history.length === 0 ? (
          <Card className="p-4 text-sm text-muted-foreground">Nenhum plano registrado</Card>
        ) : (
          <div className="space-y-2">
            {history.map((h) => (
              <Card key={h.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{h.plans?.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDateBR(h.start_date)} — {h.end_date ? formatDateBR(h.end_date) : "atual"}
                    </div>
                  </div>
                  <div className="text-sm font-mono">
                    {formatBRL(Number(h.plans?.price ?? 0))}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
