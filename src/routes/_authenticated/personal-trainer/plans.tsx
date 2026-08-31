import { Package as PageIcon } from "lucide-react";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/edufinance/EmptyState";
import { PTBadge, PTBillingBadge } from "@/components/pt/PTBadges";
import { PTPlanDialog } from "@/components/pt/PTPlanDialog";
import { formatBRL } from "@/lib/format";
import { useScopeFilter } from "@/hooks/use-scope-filter";

export const Route = createFileRoute("/_authenticated/personal-trainer/plans")({
  head: () => ({ meta: [{ title: "Planos PT — EduFinance" }] }),
  component: PTPlansPage,
});

function PTPlansPage() {
  const qc = useQueryClient();
  const { scopeId, scopeKey, ready } = useScopeFilter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data: plans = [] } = useQuery({
    queryKey: ["pt-plans-list", scopeKey],
    enabled: ready,
    queryFn: async () => {
      let q = supabase.from("pt_plans").select("*").order("name", { ascending: true });
      if (scopeId) q = q.eq("user_id", scopeId);
      return (await q).data ?? [];
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["pt-payments-by-plan", scopeKey],
    enabled: ready,
    queryFn: async () => {
      let q = supabase.from("pt_payments").select("pt_plan_id,amount,status,pt_student_id").eq("status", "paid").is("deleted_at", null);
      if (scopeId) q = q.eq("user_id", scopeId);
      return (await q).data ?? [];
    },
  });


  const stats = useMemo(() => {
    const m = new Map<string, { revenue: number; students: Set<string> }>();
    for (const p of payments) {
      if (!p.pt_plan_id) continue;
      if (!m.has(p.pt_plan_id)) m.set(p.pt_plan_id, { revenue: 0, students: new Set() });
      const s = m.get(p.pt_plan_id)!;
      s.revenue += Number(p.amount);
      s.students.add(p.pt_student_id);
    }
    return m;
  }, [payments]);

  async function toggleActive(plan: any) {
    const { error } = await supabase.from("pt_plans").update({ is_active: !plan.is_active }).eq("id", plan.id);
    if (error) return toast.error(error.message);
    toast.success(plan.is_active ? "Plano desativado" : "Plano ativado");
    qc.invalidateQueries({ queryKey: ["pt-plans-list", scopeKey] });
  }

  function priceDisplay(p: any) {
    if (p.billing_type === "monthly") return formatBRL(p.price_per_month ?? 0) + " / mês";
    if (p.billing_type === "package") return formatBRL(p.package_price ?? 0) + " · " + (p.package_sessions ?? 0) + " aulas";
    return formatBRL(p.price_per_session ?? 0) + " / aula";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={PageIcon}
        eyebrow="Personal Trainer"
        title="Planos PT"
        description="Pacotes de aulas e valores dos seus alunos de personal"
        actions={
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="h-4 w-4" /> Novo plano
          </Button>
        }
      />

      {plans.length === 0 ? (
        <Card className="p-8">
          <EmptyState title="Nenhum plano PT" description="Crie pacotes e planos de personal trainer" />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((p) => {
            const s = stats.get(p.id);
            return (
              <Card key={p.id} className={`p-5 ${!p.is_active ? "opacity-60" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold">{p.name}</h3>
                    <div className="mt-1"><PTBillingBadge type={p.billing_type} /></div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(p); setOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => toggleActive(p)} title={p.is_active ? "Desativar" : "Ativar"}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <div className="mt-3 font-mono text-lg font-bold">{priceDisplay(p)}</div>
                {p.sessions_per_month && (
                  <div className="mt-1 text-xs text-muted-foreground">{p.sessions_per_month} aulas/mês</div>
                )}
                {p.description && <p className="mt-2 text-xs text-muted-foreground">{p.description}</p>}
                <div className="mt-4 grid grid-cols-2 gap-2 border-t pt-3 text-xs">
                  <div>
                    <div className="text-muted-foreground">Alunos</div>
                    <div className="font-semibold">{s?.students.size ?? 0}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Receita</div>
                    <div className="font-semibold font-mono">{formatBRL(s?.revenue ?? 0)}</div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <PTPlanDialog open={open} onOpenChange={setOpen} plan={editing} />
    </div>
  );
}
