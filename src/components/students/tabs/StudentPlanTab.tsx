import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PauseCircle, Pencil, Trash2 } from "lucide-react";
import { PlanBadge } from "@/components/edufinance/Badges";
import { formatBRL, formatDateBR } from "@/lib/format";
import { confirmDialog } from "@/lib/confirm-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

type PlanHistoryItem = {
  id: string;
  is_current: boolean;
  start_date: string;
  end_date: string | null;
  plans: {
    name: string;
    price?: number | null;
    max_freeze_days?: number | null;
  } | null;
};

type FreezeItem = {
  id: string;
  payment_id: string | null;
  freeze_days: number;
  start_date: string;
  end_date: string;
  notes: string | null;
  created_at: string;
};

export function StudentPlanTab({
  currentPlan,
  history,
  freezes,
  onOpenNewFreeze,
  onEditFreeze,
}: {
  currentPlan?: PlanHistoryItem | null;
  history: PlanHistoryItem[];
  freezes: FreezeItem[];
  onOpenNewFreeze: () => void;
  onEditFreeze: (freeze: FreezeItem) => void;
}) {
  const qc = useQueryClient();

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Plano atual
          </div>
          <div className="mt-2 text-lg font-semibold leading-tight">
            {currentPlan?.plans?.name ?? "—"}
          </div>
          <div className="mt-1 text-sm tabular-nums text-muted-foreground">
            {currentPlan?.plans?.price ? formatBRL(Number(currentPlan.plans.price)) : "Sem valor definido"}
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Início do plano
          </div>
          <div className="mt-2 text-lg font-semibold leading-tight tabular-nums">
            {currentPlan?.start_date ? formatDateBR(currentPlan.start_date) : "—"}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            {currentPlan ? "Vigente" : "Nenhum plano vigente"}
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Trancamento
          </div>
          <div className="mt-2 text-lg font-semibold leading-tight tabular-nums">
            {currentPlan?.plans?.max_freeze_days
              ? `Até ${currentPlan.plans.max_freeze_days} dia(s)`
              : "Não permitido"}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            {freezes.length} registro(s)
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold">Histórico de planos</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum plano associado</p>
        ) : (
          <ul className="space-y-2">
            {history.map((h) => (
              <li
                key={h.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm transition-colors duration-200 hover:bg-muted/50"
              >
                <div>
                  <PlanBadge name={h.plans?.name} />
                  <span className="ml-2 text-xs tabular-nums text-muted-foreground">
                    Início: {formatDateBR(h.start_date)} · Fim: {h.end_date ? formatDateBR(h.end_date) : "atual"}
                  </span>
                </div>
                {h.is_current && <span className="text-xs font-medium text-success">Atual</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Trancamentos</h2>
          {currentPlan?.plans?.max_freeze_days ? (
            <Button
              size="sm"
              variant="outline"
              className="transition-all duration-200 active:scale-[0.98]"
              onClick={onOpenNewFreeze}
            >
              <PauseCircle className="h-4 w-4" /> Novo trancamento
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">
              Plano atual não permite trancamento.
            </span>
          )}
        </div>
        {freezes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum trancamento registrado.</p>
        ) : (
          <ul className="space-y-2">
            {freezes.map((f) => (
              <li
                key={f.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm transition-colors duration-200 hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <div className="font-medium tabular-nums">
                    {f.freeze_days} dia(s) — {formatDateBR(f.start_date)} até {formatDateBR(f.end_date)}
                  </div>
                  {f.notes && (
                    <div className="mt-1 text-xs text-muted-foreground">{f.notes}</div>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Editar trancamento"
                    className="transition-all duration-200 active:scale-[0.95]"
                    onClick={() => onEditFreeze(f)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Excluir trancamento"
                    className="transition-all duration-200 active:scale-[0.95]"
                    onClick={async () => {
                      if (!(await confirmDialog("Excluir este trancamento?"))) return;
                      const { error } = await supabase.from("payment_freezes").delete().eq("id", f.id);
                      if (error) return toast.error(error.message);
                      toast.success("Trancamento excluído");
                      qc.invalidateQueries();
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
