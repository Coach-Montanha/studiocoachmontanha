import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { ClipboardList } from "lucide-react";

export const Route = createFileRoute("/_authenticated/portal/pt/treino")({
  head: () => ({ meta: [{ title: "Meu treino — Personal Trainer" }] }),
  component: PTTreinoPage,
});

function PTTreinoPage() {
  const { user } = useAuth();

  const { data: student, isLoading } = useQuery({
    queryKey: ["pt-portal-treino", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("pt_students")
        .select("id,name,training_plan")
        .eq("account_user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Meu treino</h1>
        <p className="text-sm text-muted-foreground">Programa montado pelo seu Personal Trainer.</p>
      </div>

      <Card className="p-5">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : !student?.training_plan ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ClipboardList className="h-6 w-6" />
            </div>
            <div>
              <div className="font-semibold">Nenhum treino cadastrado ainda</div>
              <p className="text-sm text-muted-foreground mt-1">
                Assim que seu Personal Trainer publicar seu treino, ele aparecerá aqui.
              </p>
            </div>
          </div>
        ) : (
          <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-foreground">
{student.training_plan}
          </pre>
        )}
      </Card>
    </div>
  );
}
