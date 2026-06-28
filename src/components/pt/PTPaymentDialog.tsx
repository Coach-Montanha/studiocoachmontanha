import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { currentMonthKey, paymentMethodLabel } from "@/lib/format";
import { format } from "date-fns";

type PTPayment = {
  id?: string;
  pt_student_id?: string;
  pt_plan_id?: string | null;
  amount?: number;
  payment_date?: string;
  due_date?: string | null;
  reference_month?: string | null;
  payment_method?: string;
  status?: string;
  sessions_paid?: number | null;
  notes?: string | null;
};

export function PTPaymentDialog({
  open, onOpenChange, payment, defaultStudentId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  payment?: PTPayment | null;
  defaultStudentId?: string;
}) {
  const qc = useQueryClient();
  const { data: students = [] } = useQuery({
    queryKey: ["pt-students-all"],
    queryFn: async () => (await supabase.from("pt_students").select("id,name").order("name")).data ?? [],
  });
  const { data: plans = [] } = useQuery({
    queryKey: ["pt-plans-all"],
    queryFn: async () =>
      (await supabase.from("pt_plans").select("id,name,price_per_month,price_per_session,package_price,package_sessions,sessions_per_month,billing_type").order("name")).data ?? [],
  });

  const [form, setForm] = useState<PTPayment>({});
  useEffect(() => {
    if (open) {
      setForm(payment ?? {
        pt_student_id: defaultStudentId,
        payment_date: format(new Date(), "yyyy-MM-dd"),
        reference_month: currentMonthKey(),
        payment_method: "pix",
        status: "paid",
      });
    }
  }, [open, payment, defaultStudentId]);

  const planMap = useMemo(() => Object.fromEntries(plans.map((p) => [p.id, p])), [plans]);

  function applyPlan(planId: string | null) {
    if (!planId) return setForm((f) => ({ ...f, pt_plan_id: null }));
    const p = planMap[planId];
    if (!p) return;
    const amount =
      p.billing_type === "monthly" ? Number(p.price_per_month ?? 0)
      : p.billing_type === "package" ? Number(p.package_price ?? 0)
      : Number(p.price_per_session ?? 0);
    const sessions =
      p.billing_type === "monthly" ? p.sessions_per_month
      : p.billing_type === "package" ? p.package_sessions
      : 1;
    setForm((f) => ({ ...f, pt_plan_id: planId, amount: f.amount || amount, sessions_paid: f.sessions_paid ?? sessions }));
  }

  async function save() {
    if (!form.pt_student_id || !form.amount || !form.payment_date) {
      return toast.error("Preencha aluno, valor e data");
    }
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;
    const payload = {
      user_id: userId,
      pt_student_id: form.pt_student_id,
      pt_plan_id: form.pt_plan_id || null,
      amount: Number(form.amount),
      payment_date: form.payment_date,
      due_date: form.due_date || null,
      reference_month: form.reference_month || null,
      payment_method: form.payment_method ?? "pix",
      status: form.status ?? "paid",
      sessions_paid: form.sessions_paid ?? null,
      notes: form.notes ?? null,
    };
    const op = form.id
      ? supabase.from("pt_payments").update(payload).eq("id", form.id)
      : supabase.from("pt_payments").insert(payload);
    const { error } = await op;
    if (error) return toast.error(error.message);
    toast.success(form.id ? "Pagamento atualizado" : "Pagamento registrado");
    qc.invalidateQueries();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{form.id ? "Editar pagamento PT" : "Registrar pagamento PT"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label>Aluno *</Label>
            <Select value={form.pt_student_id} onValueChange={(v) => setForm((f) => ({ ...f, pt_student_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {students.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Plano</Label>
            <Select value={form.pt_plan_id ?? "none"} onValueChange={(v) => applyPlan(v === "none" ? null : v)}>
              <SelectTrigger><SelectValue placeholder="Sem plano" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem plano</SelectItem>
                {plans.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Valor (R$) *</Label>
            <Input type="number" step="0.01" value={form.amount ?? ""} onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value) }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Aulas cobertas</Label>
            <Input type="number" value={form.sessions_paid ?? ""} onChange={(e) => setForm((f) => ({ ...f, sessions_paid: e.target.value ? Number(e.target.value) : null }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Mês de referência</Label>
            <Input type="month" value={form.reference_month ?? ""} onChange={(e) => setForm((f) => ({ ...f, reference_month: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Data do pagamento *</Label>
            <Input type="date" value={form.payment_date ?? ""} onChange={(e) => setForm((f) => ({ ...f, payment_date: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Forma de pagamento</Label>
            <Select value={form.payment_method ?? "pix"} onValueChange={(v) => setForm((f) => ({ ...f, payment_method: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["pix","credit_card","debit_card","bank_slip","cash","transfer"].map((m) => (
                  <SelectItem key={m} value={m}>{paymentMethodLabel(m)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status ?? "paid"} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="paid">Pago</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="overdue">Atrasado</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Observações</Label>
            <Textarea rows={2} value={form.notes ?? ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
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
