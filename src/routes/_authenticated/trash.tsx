import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Trash2, Users, CreditCard } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/edufinance/EmptyState";
import { confirmDialog } from "@/lib/confirm-dialog";
import { useScopeFilter } from "@/hooks/use-scope-filter";
import { formatBRL, formatDateBR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/trash")({
  head: () => ({ meta: [{ title: "Lixeira — EduFinance" }] }),
  component: TrashPage,
});

type SDel = {
  id: string;
  name: string;
  deleted_at: string;
  status: string;
};

type PDel = {
  id: string;
  amount: number;
  payment_date: string;
  reference_month: string;
  deleted_at: string;
  students: { name: string } | null;
};

function TrashPage() {
  const qc = useQueryClient();
  const { scopeId, scopeKey, ready } = useScopeFilter();

  const { data: students = [], isLoading: loadS } = useQuery({
    queryKey: ["trash-students", scopeKey],
    enabled: ready,
    queryFn: async () => {
      let q = supabase
        .from("students")
        .select("id,name,deleted_at,status")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });
      if (scopeId) q = q.eq("user_id", scopeId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as SDel[];
    },
  });

  const { data: payments = [], isLoading: loadP } = useQuery({
    queryKey: ["trash-payments", scopeKey],
    enabled: ready,
    queryFn: async () => {
      let q = supabase
        .from("payments")
        .select("id,amount,payment_date,reference_month,deleted_at,students(name)")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false })
        .limit(500);
      if (scopeId) q = q.eq("user_id", scopeId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as PDel[];
    },
  });

  async function restoreStudent(id: string) {
    const { error } = await supabase
      .from("students")
      .update({ deleted_at: null })
      .eq("id", id);
    if (error) return toast.error(error.message);
    // Also restore that student's soft-deleted payments
    await supabase
      .from("payments")
      .update({ deleted_at: null })
      .eq("student_id", id)
      .not("deleted_at", "is", null);
    toast.success("Aluno restaurado");
    qc.invalidateQueries();
  }

  async function purgeStudent(id: string) {
    if (!(await confirmDialog("Excluir PERMANENTEMENTE este aluno e todos os pagamentos? Não é possível desfazer."))) return;
    const { error } = await supabase.from("students").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Excluído permanentemente");
    qc.invalidateQueries();
  }

  async function restorePayment(id: string) {
    const { error } = await supabase
      .from("payments")
      .update({ deleted_at: null })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Pagamento restaurado");
    qc.invalidateQueries();
  }

  async function purgePayment(id: string) {
    if (!(await confirmDialog("Excluir PERMANENTEMENTE este pagamento?"))) return;
    const { error } = await supabase.from("payments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Excluído permanentemente");
    qc.invalidateQueries();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Lixeira</h1>
        <p className="text-sm text-muted-foreground">
          Registros excluídos ficam aqui e podem ser restaurados. Excluir permanentemente é irreversível.
        </p>
      </div>

      <Card className="p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Alunos ({students.length})</h2>
        </div>
        {loadS ? (
          <div className="text-sm text-muted-foreground">Carregando…</div>
        ) : students.length === 0 ? (
          <EmptyState title="Nenhum aluno na lixeira" description="Alunos excluídos aparecerão aqui" />
        ) : (
          <ul className="divide-y">
            {students.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium">{s.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Excluído em {formatDateBR(s.deleted_at)}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => restoreStudent(s.id)}>
                    <RotateCcw className="h-3.5 w-3.5" /> Restaurar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => purgeStudent(s.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Pagamentos ({payments.length})</h2>
        </div>
        {loadP ? (
          <div className="text-sm text-muted-foreground">Carregando…</div>
        ) : payments.length === 0 ? (
          <EmptyState title="Nenhum pagamento na lixeira" description="Pagamentos excluídos aparecerão aqui" />
        ) : (
          <ul className="divide-y">
            {payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium">
                    {p.students?.name ?? "—"} · <span className="font-mono">{formatBRL(p.amount)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Ref {p.reference_month} · pago em {formatDateBR(p.payment_date)} · excluído em {formatDateBR(p.deleted_at)}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => restorePayment(p.id)}>
                    <RotateCcw className="h-3.5 w-3.5" /> Restaurar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => purgePayment(p.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
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
