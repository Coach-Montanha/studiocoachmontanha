import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { billingCycleLabel } from "@/lib/format";

type Plan = {
  id?: string;
  name?: string;
  price?: number;
  billing_cycle?: string;
  description?: string | null;
  is_active?: boolean;
};

export function PlanDialog({
  open,
  onOpenChange,
  plan,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  plan?: Plan | null;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Plan>({});
  useEffect(() => {
    if (open) setForm(plan ?? { billing_cycle: "monthly", is_active: true });
  }, [open, plan]);

  async function save() {
    if (!form.name || !form.price) return toast.error("Nome e preço são obrigatórios");
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;
    const payload = {
      user_id: userId,
      name: form.name,
      price: Number(form.price),
      billing_cycle: form.billing_cycle ?? "monthly",
      description: form.description ?? null,
      is_active: form.is_active ?? true,
    };
    const op = form.id
      ? supabase.from("plans").update(payload).eq("id", form.id)
      : supabase.from("plans").insert(payload);
    const { error } = await op;
    if (error) return toast.error(error.message);
    toast.success(form.id ? "Plano atualizado" : "Plano criado");
    qc.invalidateQueries();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{form.id ? "Editar plano" : "Novo plano"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome *</Label>
            <Input value={form.name ?? ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Preço (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                value={form.price ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Ciclo</Label>
              <Select value={form.billing_cycle ?? "monthly"} onValueChange={(v) => setForm((f) => ({ ...f, billing_cycle: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["monthly","quarterly","semiannual","annual"].map((c) => (
                    <SelectItem key={c} value={c}>{billingCycleLabel(c)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea rows={2} value={form.description ?? ""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
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
