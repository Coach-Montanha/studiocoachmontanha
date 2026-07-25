import { Layers } from "lucide-react";
import { useEffect, useState } from "react";
import { DialogHeadline } from "@/components/ui-kit/DialogHeadline";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type PTPlan = {
  id?: string;
  name?: string;
  billing_type?: string;
  sessions_per_month?: number | null;
  price_per_month?: number | null;
  price_per_session?: number | null;
  package_sessions?: number | null;
  package_price?: number | null;
  description?: string | null;
  is_active?: boolean;
};

export function PTPlanDialog({
  open, onOpenChange, plan,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  plan?: PTPlan | null;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<PTPlan>({});
  useEffect(() => {
    if (open) setForm(plan ?? { billing_type: "monthly", is_active: true });
  }, [open, plan]);

  async function save() {
    if (!form.name) return toast.error("Nome obrigatório");
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;
    const payload = {
      user_id: userId,
      name: form.name,
      billing_type: form.billing_type ?? "monthly",
      sessions_per_month: form.sessions_per_month ?? null,
      price_per_month: form.price_per_month ?? null,
      price_per_session: form.price_per_session ?? null,
      package_sessions: form.package_sessions ?? null,
      package_price: form.package_price ?? null,
      description: form.description ?? null,
      is_active: form.is_active ?? true,
    };
    const op = form.id
      ? supabase.from("pt_plans").update(payload).eq("id", form.id)
      : supabase.from("pt_plans").insert(payload);
    const { error } = await op;
    if (error) return toast.error(error.message);
    toast.success(form.id ? "Plano atualizado" : "Plano criado");
    qc.invalidateQueries();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeadline icon={Layers} title={<>{form.id ? "Editar plano PT" : "Novo plano PT"}</>} description="Defina valor, número de aulas e validade do plano PT." />
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label>Nome *</Label>
            <Input value={form.name ?? ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Tipo de cobrança</Label>
            <Select value={form.billing_type ?? "monthly"} onValueChange={(v) => setForm((f) => ({ ...f, billing_type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Mensal</SelectItem>
                <SelectItem value="per_session">Por sessão</SelectItem>
                <SelectItem value="package">Pacote</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Aulas/mês</Label>
            <Input type="number" value={form.sessions_per_month ?? ""} onChange={(e) => setForm((f) => ({ ...f, sessions_per_month: e.target.value ? Number(e.target.value) : null }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Preço mensal (R$)</Label>
            <Input type="number" step="0.01" value={form.price_per_month ?? ""} onChange={(e) => setForm((f) => ({ ...f, price_per_month: e.target.value ? Number(e.target.value) : null }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Preço por sessão (R$)</Label>
            <Input type="number" step="0.01" value={form.price_per_session ?? ""} onChange={(e) => setForm((f) => ({ ...f, price_per_session: e.target.value ? Number(e.target.value) : null }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Aulas no pacote</Label>
            <Input type="number" value={form.package_sessions ?? ""} onChange={(e) => setForm((f) => ({ ...f, package_sessions: e.target.value ? Number(e.target.value) : null }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Preço do pacote (R$)</Label>
            <Input type="number" step="0.01" value={form.package_price ?? ""} onChange={(e) => setForm((f) => ({ ...f, package_price: e.target.value ? Number(e.target.value) : null }))} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Descrição</Label>
            <Textarea rows={2} value={form.description ?? ""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="col-span-2 flex items-center justify-between rounded-lg border p-3">
            <div>
              <div className="text-sm font-medium">Ativo</div>
              <div className="text-xs text-muted-foreground">Planos inativos não aparecem em novas vendas</div>
            </div>
            <Switch checked={form.is_active ?? true} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
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
