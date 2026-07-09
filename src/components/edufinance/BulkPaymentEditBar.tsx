import { useState } from "react";
import { confirmDialog } from "@/lib/confirm-dialog";
import { Loader2, X, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { usePaymentMethods } from "@/hooks/use-payment-methods";

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
  const [busy, setBusy] = useState<null | "method" | "status" | "delete">(null);

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

  return (
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
          <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
            <Check className="h-3 w-3" /> aplicado
          </span>
        )}
      </div>
    </div>
  );
}
