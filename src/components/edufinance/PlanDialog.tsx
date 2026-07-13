import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { billingCycleLabel } from "@/lib/format";

type QuotaType = "none" | "weekly" | "monthly" | "package";

type Plan = {
  id?: string;
  name?: string;
  price?: number;
  billing_cycle?: string;
  description?: string | null;
  is_active?: boolean;
  checkin_quota_type?: QuotaType;
  checkin_quota_amount?: number | null;
  package_valid_days?: number | null;
  max_freeze_days?: number | null;
  auto_renew?: boolean;
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
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);

  const { data: programs = [] } = useQuery({
    queryKey: ["plan-dialog-programs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("programs")
        .select("id,name,color")
        .eq("is_active", true)
        .order("name");
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!open) return;
    setForm(
      plan ?? {
        billing_cycle: "monthly",
        is_active: true,
        checkin_quota_type: "none",
      },
    );
    // Load existing plan_programs when editing
    if (plan?.id) {
      supabase
        .from("plan_programs")
        .select("program_id")
        .eq("plan_id", plan.id)
        .then(({ data }) => {
          setSelectedPrograms((data ?? []).map((r: any) => r.program_id));
        });
    } else {
      setSelectedPrograms([]);
    }
  }, [open, plan]);

  function toggleProgram(id: string) {
    setSelectedPrograms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }

  async function save() {
    if (!form.name || !form.price) return toast.error("Nome e preço são obrigatórios");
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;

    const quotaType = form.checkin_quota_type ?? "none";
    if (quotaType !== "none" && (!form.checkin_quota_amount || form.checkin_quota_amount <= 0)) {
      return toast.error("Informe a quantidade de check-ins do plano");
    }
    if (quotaType === "package" && (!form.package_valid_days || form.package_valid_days <= 0)) {
      return toast.error("Informe a validade do pacote em dias");
    }

    const payload = {
      user_id: userId,
      name: form.name,
      price: Number(form.price),
      billing_cycle: form.billing_cycle ?? "monthly",
      description: form.description ?? null,
      is_active: form.is_active ?? true,
      checkin_quota_type: quotaType,
      checkin_quota_amount: quotaType === "none" ? null : Number(form.checkin_quota_amount),
      package_valid_days: quotaType === "package" ? Number(form.package_valid_days) : null,
      max_freeze_days:
        form.max_freeze_days === null || form.max_freeze_days === undefined || Number(form.max_freeze_days) <= 0
          ? null
          : Number(form.max_freeze_days),
      auto_renew: form.auto_renew ?? false,
    };

    let planId = form.id;
    if (planId) {
      const { error } = await supabase.from("plans").update(payload).eq("id", planId);
      if (error) return toast.error(error.message);
    } else {
      const { data: inserted, error } = await supabase
        .from("plans")
        .insert(payload)
        .select("id")
        .single();
      if (error) return toast.error(error.message);
      planId = inserted.id;
    }

    // Sync plan_programs
    if (planId) {
      await supabase.from("plan_programs").delete().eq("plan_id", planId);
      if (selectedPrograms.length > 0) {
        const rows = selectedPrograms.map((pid) => ({
          plan_id: planId!,
          program_id: pid,
          user_id: userId,
        }));
        const { error: linkErr } = await supabase.from("plan_programs").insert(rows);
        if (linkErr) return toast.error(linkErr.message);
      }
    }

    toast.success(form.id ? "Plano atualizado" : "Plano criado");
    qc.invalidateQueries();
    onOpenChange(false);
  }

  const quotaType = form.checkin_quota_type ?? "none";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
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

          <div className="pt-3 border-t space-y-3">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Cota de check-ins</div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select
                value={quotaType}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    checkin_quota_type: v as QuotaType,
                    checkin_quota_amount: v === "none" ? null : f.checkin_quota_amount,
                    package_valid_days: v === "package" ? f.package_valid_days ?? 30 : null,
                  }))
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem limite</SelectItem>
                  <SelectItem value="weekly">Semanal (reinicia às segundas)</SelectItem>
                  <SelectItem value="monthly">Mensal (reinicia dia 1º)</SelectItem>
                  <SelectItem value="package">Pacote com validade em dias</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {quotaType !== "none" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Nº de check-ins</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.checkin_quota_amount ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, checkin_quota_amount: Number(e.target.value) }))}
                    placeholder={quotaType === "weekly" ? "Ex: 2" : quotaType === "monthly" ? "Ex: 8" : "Ex: 10"}
                  />
                </div>
                {quotaType === "package" && (
                  <div className="space-y-1.5">
                    <Label>Validade (dias)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={form.package_valid_days ?? 30}
                      onChange={(e) => setForm((f) => ({ ...f, package_valid_days: Number(e.target.value) }))}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="pt-3 border-t space-y-2">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Trancamento</div>
            <p className="text-xs text-muted-foreground">
              Limite máximo de dias que o aluno pode trancar por pagamento. Deixe em branco (ou 0) para não permitir trancamento.
            </p>
            <div className="space-y-1.5">
              <Label>Máx. de dias por trancamento</Label>
              <Input
                type="number"
                min={0}
                value={form.max_freeze_days ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    max_freeze_days: e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
                placeholder="Ex.: 30"
              />
            </div>
            <label className="flex items-start gap-2 rounded-md border p-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4"
                checked={!!form.auto_renew}
                onChange={(e) => setForm((f) => ({ ...f, auto_renew: e.target.checked }))}
              />
              <div className="text-xs">
                <div className="font-medium">Plano renovável automaticamente</div>
                <div className="text-muted-foreground">
                  Novos pagamentos deste plano nascem marcados como renováveis. Você poderá renovar cada pagamento com um clique.
                </div>
              </div>
            </label>
          </div>

          <div className="pt-3 border-t space-y-2">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Programas liberados</div>
            <p className="text-xs text-muted-foreground">
              Selecione as modalidades que este plano libera. Se nenhuma for marcada, o plano libera <strong>todas</strong>.
            </p>
            {programs.length === 0 ? (
              <div className="text-xs text-muted-foreground italic">
                Nenhum programa cadastrado ainda.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {programs.map((p: any) => {
                  const selected = selectedPrograms.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleProgram(p.id)}
                      className={`px-3 py-1 rounded-full text-xs border-2 transition ${
                        selected
                          ? "text-white font-medium"
                          : "bg-background text-foreground hover:bg-muted"
                      }`}
                      style={{
                        borderColor: p.color ?? "#94a3b8",
                        backgroundColor: selected ? (p.color ?? "#94a3b8") : undefined,
                      }}
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
            )}
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
