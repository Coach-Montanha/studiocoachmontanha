import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { FormSection, Field } from "@/components/ui-kit/FormSection";
import { Receipt, Loader2 } from "lucide-react";
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
    queryKey: ["plans-all-payment-dialog"],
    queryFn: async () => {
      const { data } = await supabase
        .from("plans")
        .select(
          "id,name,price,billing_cycle,auto_renew,max_renewals,checkin_quota_type,checkin_quota_amount,package_valid_days",
        )
        .order("name");
      return data ?? [];
    },
  });

  /** Plano do tipo "pacote com validade em dias"? */
  function packageDays(plan: any): number | null {
    if (!plan) return null;
    const days = Number(plan.package_valid_days ?? 0);
    return plan.checkin_quota_type === "package" && days > 0 ? days : null;
  }

  function computeDueDate(paymentDate: string | undefined, plan: any) {
    if (!paymentDate) return null;
    const d = new Date(paymentDate + "T00:00:00");
    if (isNaN(d.getTime())) return null;
    const days = packageDays(plan);
    if (days != null) {
      // Pacotes valem pela validade em dias, não pelo ciclo de cobrança.
      d.setDate(d.getDate() + days);
      return format(d, "yyyy-MM-dd");
    }
    switch (plan?.billing_cycle) {
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
  const [saving, setSaving] = useState(false);
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

  const selectedPlan: any = form.plan_id ? planMap[form.plan_id] : null;
  const pkgDays = packageDays(selectedPlan);
  const suggestedDue = useMemo(
    () => (selectedPlan ? computeDueDate(form.payment_date, selectedPlan) : null),
    [selectedPlan, form.payment_date],
  );
  const dueMismatch = Boolean(suggestedDue && form.due_date && form.due_date !== suggestedDue);
  const dueLabel = form.due_date
    ? format(new Date(`${form.due_date}T00:00:00`), "dd/MM/yyyy")
    : null;


  async function save() {
    if (!form.student_id || !form.amount || !form.payment_date || !form.reference_month) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;
    const basePayload = {
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
    // On update, don't overwrite user_id — preserves ownership when a super admin
    // fixes a payment that belongs to another tenant.
    let insertPayload: any = { ...basePayload, user_id: userId };
    if (!form.id && form.plan_id) {
      const plan = planMap[form.plan_id] as any;
      if (plan?.auto_renew) {
        insertPayload.auto_renew = true;
        if (plan.max_renewals != null) insertPayload.renewals_remaining = Number(plan.max_renewals);
      }
    }
    const res = form.id
      ? await supabase.from("payments").update(basePayload).eq("id", form.id).select("id")
      : await supabase.from("payments").insert(insertPayload).select("id");
    if (res.error) return toast.error(res.error.message);
    if (!res.data || res.data.length === 0) {
      return toast.error("Nada foi salvo. Você não tem permissão para editar este pagamento.");
    }
    
    toast.success(form.id ? "Pagamento atualizado" : "Pagamento registrado");
    qc.invalidateQueries();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15"
            >
              <Receipt className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <DialogTitle>{form.id ? "Editar pagamento" : "Novo pagamento"}</DialogTitle>
              <DialogDescription>
                {form.id
                  ? "Ajuste os dados deste lançamento."
                  : "Registre um pagamento e vincule ao plano do aluno."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5">
          <FormSection title="Aluno e plano" divided={false}>
            <Field full label="Aluno *">
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
            </Field>

            <Field full label="Plano">
              <Select
                value={form.plan_id ?? "none"}
                onValueChange={(v) => {
                  const planId = v === "none" ? null : v;
                  const plan = planId ? planMap[planId] : null;
                  setForm((f) => ({
                    ...f,
                    plan_id: planId,
                    amount: f.amount ?? (plan ? Number(plan.price ?? 0) : f.amount),
                    due_date: plan ? computeDueDate(f.payment_date, plan) : f.due_date,
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
              {pkgDays != null && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-caption font-medium text-primary ring-1 ring-inset ring-primary/15">
                    <Ticket className="h-3.5 w-3.5" aria-hidden />
                    {Number(selectedPlan?.checkin_quota_amount ?? 0)} check-ins
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-caption font-medium text-muted-foreground ring-1 ring-inset ring-border">
                    <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                    <span className="tabular-nums">{pkgDays}</span> dias de validade
                  </span>
                </div>
              )}
            </Field>

          </FormSection>

          <FormSection title="Valores e datas">
            <Field label="Valor (R$) *">
              <Input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={form.amount ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value) }))}
              />
            </Field>

            <Field label="Mês de referência *">
              <Input
                type="month"
                value={form.reference_month ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, reference_month: e.target.value }))}
              />
            </Field>

            <Field label="Data do pagamento *">
              <Input
                type="date"
                value={form.payment_date ?? ""}
                onChange={(e) => setForm((f) => {
                  const plan = f.plan_id ? planMap[f.plan_id] : null;
                  return { ...f, payment_date: e.target.value, due_date: plan ? computeDueDate(e.target.value, plan.billing_cycle) : f.due_date };
                })}
              />
            </Field>

            <Field label="Vencimento" hint="Calculado pelo ciclo do plano — pode ajustar.">
              <Input
                type="date"
                value={form.due_date ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
              />
            </Field>
          </FormSection>

          <FormSection title="Situação">
            <Field label="Forma de pagamento">
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
            </Field>

            <Field label="Status">
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
            </Field>

            <Field full label="Notas">
              <Textarea
                rows={2}
                placeholder="Observações internas (opcional)"
                value={form.notes ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </Field>
          </FormSection>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={async () => {
              setSaving(true);
              try {
                await save();
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
