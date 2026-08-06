import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { addDays, format } from "date-fns";

type Freeze = {
  id?: string;
  student_id?: string;
  payment_id?: string | null;
  freeze_days?: number;
  start_date?: string;
  end_date?: string;
  notes?: string | null;
};

export function FreezeDialog({
  open,
  onOpenChange,
  studentId,
  paymentId,
  maxDays,
  planName,
  freeze,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  studentId: string;
  paymentId?: string | null;
  maxDays?: number | null;
  planName?: string | null;
  freeze?: Freeze | null;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Freeze>({});

  useEffect(() => {
    if (!open) return;
    setForm(
      freeze ?? {
        start_date: format(new Date(), "yyyy-MM-dd"),
        freeze_days: 7,
        notes: "",
      },
    );
  }, [open, freeze]);

  const days = Number(form.freeze_days ?? 0);
  const computedEnd =
    form.start_date && days > 0
      ? format(addDays(new Date(form.start_date + "T00:00"), days), "yyyy-MM-dd")
      : "";

  async function save() {
    if (!form.start_date) return toast.error("Informe a data de início do trancamento");
    if (!days || days <= 0) return toast.error("Informe a quantidade de dias");
    if (maxDays && days > maxDays) {
      return toast.error(`Este plano permite no máximo ${maxDays} dias de trancamento.`);
    }

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;

    // Se estiver congelando um aluno PT, atualizamos o status dele também
    const { data: isPt } = await supabase.from("pt_students").select("id").eq("id", studentId).maybeSingle();
    if (isPt) {
      await supabase.from("pt_students").update({ status: "paused" }).eq("id", studentId);
    } else {
      await supabase.from("students").update({ status: "paused" }).eq("id", studentId);
    }

    const payload = {
      user_id: userId,
      student_id: studentId,
      payment_id: paymentId ?? null,
      freeze_days: days,
      start_date: form.start_date,
      end_date: computedEnd,
      notes: form.notes ?? null,
    };

    if (form.id) {
      const { error } = await supabase.from("payment_freezes").update(payload).eq("id", form.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("payment_freezes").insert(payload);
      if (error) return toast.error(error.message);
    }
    toast.success(form.id ? "Trancamento atualizado" : "Trancamento registrado");
    qc.invalidateQueries();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{form.id ? "Editar trancamento" : "Trancar plano"}</DialogTitle>
          <DialogDescription>
            {planName ? <>Plano: <strong>{planName}</strong>. </> : null}
            {maxDays
              ? `Limite deste plano: ${maxDays} dias.`
              : "Este plano não define um limite máximo de dias para compensação automática, mas o trancamento pode ser realizado."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Início do trancamento</Label>
              <Input
                type="date"
                value={form.start_date ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Dias</Label>
              <Input
                type="number"
                min={1}
                max={maxDays ?? undefined}
                value={form.freeze_days ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, freeze_days: Number(e.target.value) }))}
              />
            </div>
          </div>
          <div className="rounded-md border bg-muted/40 p-3 text-xs">
            Vencimento será estendido até:{" "}
            <strong>{computedEnd ? new Date(computedEnd + "T00:00").toLocaleDateString("pt-BR") : "—"}</strong>
          </div>
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea
              rows={2}
              value={form.notes ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Motivo do trancamento (opcional)"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
