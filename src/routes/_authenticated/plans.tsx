import { createFileRoute } from "@tanstack/react-router";
import { confirmDialog } from "@/lib/confirm-dialog";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlanDialog } from "@/components/edufinance/PlanDialog";
import { EmptyState } from "@/components/edufinance/EmptyState";
import { billingCycleLabel, formatBRL } from "@/lib/format";
import { useScopeFilter } from "@/hooks/use-scope-filter";

export const Route = createFileRoute("/_authenticated/plans")({
  head: () => ({ meta: [{ title: "Planos — EduFinance" }] }),
  component: PlansPage,
});

type PlanRow = {
  id: string; name: string; price: number; billing_cycle: string;
  description: string | null; is_active: boolean;
  payments: { amount: number }[];
  student_plan_history: { is_current: boolean; student_id: string }[];
};

function PlansPage() {
  const qc = useQueryClient();
  const { scopeId, scopeKey, ready } = useScopeFilter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PlanRow | null>(null);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["plans-list", scopeKey],
    enabled: ready,
    queryFn: async () => {
      let q = supabase
        .from("plans")
        .select("id,name,price,billing_cycle,description,is_active,checkin_quota_type,checkin_quota_amount,package_valid_days,max_freeze_days,auto_renew,max_renewals,payments(amount),student_plan_history(is_current,student_id)")
        .order("name", { ascending: true });
      if (scopeId) q = q.eq("user_id", scopeId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as PlanRow[];
    },
  });


  async function remove(id: string) {
    if (!(await confirmDialog("Excluir este plano?"))) return;
    const { error } = await supabase.from("plans").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Plano excluído");
    qc.invalidateQueries();
  }

  async function toggleActive(p: PlanRow) {
    await supabase.from("plans").update({ is_active: !p.is_active }).eq("id", p.id);
    qc.invalidateQueries();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Planos</h1>
          <p className="text-sm text-muted-foreground">Gerencie os planos do seu negócio</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4" /> Novo plano
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : plans.length === 0 ? (
        <EmptyState title="Nenhum plano" description="Crie seu primeiro plano para começar" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((p) => {
            const activeStudents = p.student_plan_history.filter((h) => h.is_current).length;
            const revenue = p.payments.reduce((s, x) => s + Number(x.amount), 0);
            return (
              <Card key={p.id} className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-semibold">{p.name}</h3>
                    <span className="mt-1 inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {billingCycleLabel(p.billing_cycle)}
                    </span>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${p.is_active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                    {p.is_active ? "Ativo" : "Inativo"}
                  </span>
                </div>
                <div className="mt-4 font-mono text-2xl font-bold">{formatBRL(p.price)}</div>
                {p.description && <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>}
                <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-4 text-sm">
                  <div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" /> Alunos
                    </div>
                    <div className="font-mono font-semibold">{activeStudents}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Receita total</div>
                    <div className="font-mono font-semibold">{formatBRL(revenue)}</div>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => { setEditing(p); setOpen(true); }}>
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => toggleActive(p)}>
                    {p.is_active ? "Desativar" : "Ativar"}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(p.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <PlanDialog open={open} onOpenChange={setOpen} plan={editing} />
    </div>
  );
}
