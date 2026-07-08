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
import { currentMonthKey } from "@/lib/format";
import { usePaymentMethods } from "@/hooks/use-payment-methods";
import { format } from "date-fns";

type Payment = {
  id?: string;
  student_id?: string;
  plan_id?: string | null;
  amount?: number;
  payment_date?: string;
  due_date?: string | null;
  reference_month?: string;
  payment_method?: string;
  status?: string;
  notes?: string | null;
};

export function PaymentDialog({
  open,
  onOpenChange,
  payment,
  defaultStudentId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  payment?: Payment | null;
  defaultStudentId?: string;
}) {
  const qc = useQueryClient();
  const { methods: paymentMethods, labelFor: pmLabel } = usePaymentMethods({ activeOnly: true });
  const { data: students = [] } = useQuery({
    queryKey: ["students-all"],
    queryFn: async () => {
      const { data } = await supabase.from("students").select("id,name").order("name");
      return data ?? [];
    },
  });
  const { data: plans = [] } = useQuery({
    queryKey: ["plans-all"],
    queryFn: async () => {
      const { data } = await supabase.from("plans").select("id,name,price,billing_cycle").order("name");
      return data ?? [];
    },
  });

  function computeDueDate(paymentDate: string | undefined, cycle: string | undefined) {
    if (!paymentDate) return null;
    const d = new Date(paymentDate + "T00:00:00");
    if (isNaN(d.getTime())) return null;
    switch (cycle) {
      case "monthly": d.setDate(d.getDate() + 30); break;
      case "quarterly": d.setMonth(d.getMonth() + 3); break;
      case "semiannual":
      case "semi_annual":
      case "biannual": d.setMonth(d.getMonth() + 6); break;
      case "annual":
      case "yearly": d.setFullYear(d.getFullYear() + 1); break;
      default: d.setDate(d.getDate() + 30);
    }
    return format(d, "yyyy-MM-dd");
  }

  const [form, setForm] = useState<Payment>({});
  useEffect(() => {
    if (open) {
      setForm(
        payment ?? {
          student_id: defaultStudentId,
          payment_date: format(new Date(), "yyyy-MM-dd"),
          reference_month: currentMonthKey(),
          payment_method: "pix",
          status: "paid",
        },
      );
    }
  }, [open, payment, defaultStudentId]);

  const planMap = useMemo(() => Object.fromEntries(plans.map((p) => [p.id, p])), [plans]);

  async function save() {
    if (!form.student_id || !form.amount || !form.payment_date || !form.reference_month) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;
    const payload = {
      user_id: userId,
      student_id: form.student_id,
      plan_id: form.plan_id || null,
      amount: Number(form.amount),
      payment_date: form.payment_date,
      due_date: form.due_date || null,
      reference_month: form.reference_month,
      payment_method: form.payment_method ?? "pix",
      status: form.status ?? "paid",
      notes: form.notes ?? null,
    };
    const op = form.id
      ? supabase.from("payments").update(payload).eq("id", form.id)
      : supabase.from("payments").insert(payload);
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
          <DialogTitle>{form.id ? "Editar pagamento" : "Novo pagamento"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label>Aluno *</Label>
            <Select
              value={form.student_id}
              onValueChange={(v) => setForm((f) => ({ ...f, student_id: v }))}
            >
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {students.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-2 space-y-1.5">
            <Label>Plano</Label>
            <Select
              value={form.plan_id ?? "none"}
              onValueChange={(v) => {
                const planId = v === "none" ? null : v;
                const plan = planId ? planMap[planId] : null;
                setForm((f) => ({
                  ...f,
                  plan_id: planId,
                  amount: f.amount ?? (plan ? Number(plan.price ?? 0) : f.amount),
                  due_date: plan ? computeDueDate(f.payment_date, plan.billing_cycle) : f.due_date,
                }));
              }}
            >
              <SelectTrigger><SelectValue placeholder="Sem plano" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem plano</SelectItem>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Valor (R$) *</Label>
            <Input
              type="number"
              step="0.01"
              value={form.amount ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value) }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Mês de referência *</Label>
            <Input
              type="month"
              value={form.reference_month ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, reference_month: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Data do pagamento *</Label>
            <Input
              type="date"
              value={form.payment_date ?? ""}
              onChange={(e) => setForm((f) => {
                const plan = f.plan_id ? planMap[f.plan_id] : null;
                return { ...f, payment_date: e.target.value, due_date: plan ? computeDueDate(e.target.value, plan.billing_cycle) : f.due_date };
              })}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Vencimento</Label>
            <Input
              type="date"
              value={form.due_date ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Forma de pagamento</Label>
            <Select
              value={form.payment_method ?? "pix"}
              onValueChange={(v) => setForm((f) => ({ ...f, payment_method: v }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(paymentMethods.length > 0
                  ? paymentMethods.map((m) => ({ key: m.key, label: m.label }))
                  : ["pix","credit_card","debit_card","bank_slip","cash","transfer"].map((k) => ({ key: k, label: pmLabel(k) }))
                ).map((m) => (
                  <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              value={form.status ?? "paid"}
              onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
            >
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
            <Label>Notas</Label>
            <Textarea
              rows={2}
              value={form.notes ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
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
