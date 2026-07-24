import { useState } from "react";
import { confirmDialog } from "@/lib/confirm-dialog";
import { Loader2, X, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { usePaymentMethods } from "@/hooks/use-payment-methods";
import { formatBRL } from "@/lib/format";

const STATUS_OPTIONS = [
  { value: "paid", label: "Pago" },
  { value: "pending", label: "Pendente" },
  { value: "overdue", label: "Atrasado" },
  { value: "cancelled", label: "Cancelado" },
];

export function BulkPaymentEditBar({
  selectedIds,
  onClear,
}: {
  selectedIds: string[];
  onClear: () => void;
}) {
  const qc = useQueryClient();
  const { methods } = usePaymentMethods({ activeOnly: true });
  const [method, setMethod] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState<null | "method" | "status" | "delete" | "plan">(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [planId, setPlanId] = useState("");

  const { data: plans = [] } = useQuery({
    queryKey: ["plans-active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("plans")
        .select("id,name,price")
        .eq("is_active", true)
        .order("name");
      return data ?? [];
    },
  });

  const count = selectedIds.length;
  if (count === 0) return null;

  async function applyUpdate(patch: { payment_method?: string; status?: string }, kind: "method" | "status") {
    setBusy(kind);
    const { error } = await supabase.from("payments").update(patch).in("id", selectedIds);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(`${count} pagamento(s) atualizado(s).`);
    qc.invalidateQueries();
    onClear();
  }

  async function bulkDelete() {
    if (!(await confirmDialog(`Excluir ${count} pagamento(s)? Esta ação não pode ser desfeita.`))) return;
    setBusy("delete");
    const { error } = await supabase.from("payments").delete().in("id", selectedIds);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(`${count} pagamento(s) excluído(s).`);
    qc.invalidateQueries();
    onClear();
  }

  async function applyPlan() {
    if (!planId) return;
    setBusy("plan");
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) { setBusy(null); return; }

    // Update plan_id on the selected payments themselves (so imported/old payments get the plan)
    const { error: updErr } = await supabase
      .from("payments")
      .update({ plan_id: planId })
      .in("id", selectedIds);
    if (updErr) { setBusy(null); return toast.error(updErr.message); }

    // Derive unique student ids from selected payments
    const { data: pays, error: payErr } = await supabase
      .from("payments")
      .select("student_id, payment_date")
      .in("id", selectedIds)
      .order("payment_date", { ascending: false });
    if (payErr) { setBusy(null); return toast.error(payErr.message); }

    const latestByStudent = new Map<string, string>();
    for (const p of (pays ?? []) as any[]) {
      if (!latestByStudent.has(p.student_id)) latestByStudent.set(p.student_id, p.payment_date);
    }

    let ok = 0;
    const errs: string[] = [];
    for (const [sid, startDate] of latestByStudent) {
      await supabase
        .from("student_plan_history")
        .update({ end_date: startDate, is_current: false })
        .eq("student_id", sid)
        .eq("is_current", true);
      const { error } = await supabase.from("student_plan_history").insert({
        user_id: userId,
        student_id: sid,
        plan_id: planId,
        start_date: startDate,
        is_current: true,
      });
      if (error) errs.push(error.message); else ok++;
    }
    setBusy(null);
    setPlanOpen(false);
    setPlanId("");
    qc.invalidateQueries();
    toast.success(`Plano vinculado a ${count} pagamento(s)` + (ok ? ` e ${ok} aluno(s) atualizados` : ""));
    if (errs.length) toast.error(`${errs.length} erro(s) ao atualizar histórico`);
    onClear();
  }


  return (
    <>
      <div className="sticky bottom-3 z-20 mx-auto flex w-full max-w-3xl flex-col gap-2 rounded-xl border bg-card p-3 shadow-lg ring-1 ring-primary/10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-primary px-2 text-xs font-semibold text-primary-foreground">
            {count}
          </span>
          <span className="text-sm font-medium">selecionado(s)</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClear} aria-label="Limpar seleção">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={method}
            onValueChange={(v) => {
              setMethod(v);
              applyUpdate({ payment_method: v }, "method");
            }}
          >
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue placeholder="Alterar forma…" />
            </SelectTrigger>
            <SelectContent>
              {methods.map((m) => (
                <SelectItem key={m.key} value={m.key}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v);
              applyUpdate({ status: v }, "status");
            }}
          >
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue placeholder="Alterar status…" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="secondary"
            size="sm"
            className="h-9"
            onClick={() => setPlanOpen(true)}
            disabled={busy !== null}
          >
            Alterar plano
          </Button>
          <Button variant="destructive" size="sm" className="h-9" onClick={bulkDelete} disabled={busy !== null}>
            {busy === "delete" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Excluir
          </Button>
          {busy && busy !== "delete" && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> aplicando…
            </span>
          )}
          {!busy && (method || status) && (
            <span className="inline-flex items-center gap-1 text-xs text-state-paid">
              <Check className="h-3 w-3" /> aplicado
            </span>
          )}
        </div>
      </div>

      <AlertDialog open={planOpen} onOpenChange={setPlanOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alterar plano em massa</AlertDialogTitle>
            <AlertDialogDescription>
              Isso encerrará o plano atual dos alunos vinculados aos {count} pagamento(s)
              selecionado(s) e iniciará o novo plano a partir de hoje.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger><SelectValue placeholder="Selecione um plano" /></SelectTrigger>
              <SelectContent>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — {formatBRL(Number(p.price))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={applyPlan} disabled={!planId || busy === "plan"}>
              {busy === "plan" ? "Aplicando…" : "Aplicar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
