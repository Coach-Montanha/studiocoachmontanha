import { Receipt } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DialogHeadline } from "@/components/ui-kit/DialogHeadline";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
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
    queryFn: async () => (await supabase.from("pt_students").select("id,name").is("deleted_at", null).order("name")).data ?? [],
  });
  const { data: plans = [] } = useQuery({
    queryKey: ["pt-plans-all"],
    queryFn: async () =>
      (await supabase.from("pt_plans").select("id,name,price_per_month,price_per_session,package_price,package_sessions,sessions_per_month,billing_type").order("name")).data ?? [],
  });

  const [form, setForm] = useState<PTPayment>({});
  const [historicalSessions, setHistoricalSessions] = useState<number | "">("");
  useEffect(() => {
    if (open) {
      setForm(payment ?? {
        pt_student_id: defaultStudentId,
        payment_date: format(new Date(), "yyyy-MM-dd"),
        reference_month: currentMonthKey(),
        payment_method: "pix",
        status: "paid",
      });
      setHistoricalSessions("");
    }
  }, [open, payment, defaultStudentId]);

  const planMap = useMemo(() => Object.fromEntries(plans.map((p) => [p.id, p])), [plans]);

  const activePlan = form.pt_plan_id ? planMap[form.pt_plan_id] : null;
  const billingType: string | null = activePlan?.billing_type ?? null;
  const isMonthly = billingType === "monthly";
  const isBySession = billingType === "per_session" || billingType === "package";

  function addDaysISO(iso: string, days: number) {
    const d = new Date(`${iso}T12:00:00`);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

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
    setForm((f) => {
      const nextDue =
        p.billing_type === "monthly" && f.payment_date
          ? addDaysISO(f.payment_date, 30)
          : null;
      return {
        ...f,
        pt_plan_id: planId,
        amount: f.amount || amount,
        sessions_paid: f.sessions_paid ?? sessions,
        due_date: nextDue ?? f.due_date ?? null,
      };
    });
  }

  // Se muda a data de pagamento e o plano é mensal, recalcula o vencimento (30 dias após).
  useEffect(() => {
    if (!isMonthly || !form.payment_date) return;
    setForm((f) => ({ ...f, due_date: addDaysISO(f.payment_date!, 30) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.payment_date, isMonthly]);

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
      // Planos por aula/pacote não têm data fixa — vencem ao esgotar as aulas.
      due_date: isBySession ? null : (form.due_date || null),
      reference_month: form.reference_month || null,
      payment_method: form.payment_method ?? "pix",
      status: form.status ?? "paid",
      sessions_paid: form.sessions_paid ?? null,
      notes: form.notes ?? null,
    };
    const op = form.id
      ? supabase.from("pt_payments").update(payload).eq("id", form.id)
      : supabase.from("pt_payments").insert(payload).select("id").single();
    const { data: opData, error } = await op;
    if (error) return toast.error(error.message);

    // Ao criar um pagamento novo, permite registrar N aulas históricas
    // já realizadas, vinculadas a este pagamento (útil para migração/histórico).
    const newPaymentId = !form.id ? (opData as any)?.id : null;
    const count = typeof historicalSessions === "number" ? historicalSessions : 0;
    if (newPaymentId && count > 0 && form.pt_student_id) {
      const baseDate = new Date(`${form.payment_date}T12:00:00`);
      const sessionRows = Array.from({ length: count }).map((_, i) => {
        const d = new Date(baseDate);
        d.setDate(d.getDate() - i);
        return {
          user_id: userId,
          pt_student_id: form.pt_student_id!,
          pt_payment_id: newPaymentId,
          session_date: d.toISOString().slice(0, 10),
          duration_minutes: 60,
          status: "completed",
          performance_notes: "Registro histórico (importado com o pagamento)",
        };
      });
      const { error: sErr } = await supabase.from("pt_sessions").insert(sessionRows);
      if (sErr) toast.error(`Pagamento salvo, mas falhou ao registrar aulas: ${sErr.message}`);
    }

    toast.success(form.id ? "Pagamento atualizado" : "Pagamento registrado");
    qc.invalidateQueries();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeadline icon={Receipt} title={<>{form.id ? "Editar pagamento PT" : "Registrar pagamento PT"}</>} description="Lançamento financeiro vinculado ao plano do aluno PT." />
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
                <SelectItem value="none">Sem plano (avulso)</SelectItem>
                {plans.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {!form.pt_plan_id && (
              <p className="text-xs text-muted-foreground">
                💡 Pagamento avulso — não vinculado a nenhum plano. Use para registros históricos ou aulas pontuais.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Valor (R$) *</Label>
            <Input type="number" step="0.01" value={form.amount ?? ""} onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value) }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Aulas cobertas</Label>
            <Input type="number" value={form.sessions_paid ?? ""} onChange={(e) => setForm((f) => ({ ...f, sessions_paid: e.target.value ? Number(e.target.value) : null }))} />
          </div>
          {!form.id && (
            <div className="col-span-2 space-y-1.5 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3">
              <Label className="text-xs">Aulas já realizadas (histórico)</Label>
              <Input
                type="number"
                min={0}
                placeholder="Ex.: 8"
                value={historicalSessions}
                onChange={(e) => setHistoricalSessions(e.target.value ? Number(e.target.value) : "")}
              />
              <p className="text-[11px] text-muted-foreground">
                Ao salvar, serão criadas automaticamente N aulas com status <strong>Realizada</strong> vinculadas a este pagamento
                (datadas retroativamente a partir da data do pagamento). Use para migrar alunos antigos sem precisar registrar aula por aula.
              </p>
            </div>
          )}
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
            <Label>Vencimento</Label>
            {isBySession ? (
              <div className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/30 p-2 text-xs text-muted-foreground">
                📦 Plano por aula/pacote — vence automaticamente quando as aulas contratadas se esgotarem.
              </div>
            ) : (
              <>
                <Input
                  type="date"
                  value={form.due_date ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value || null }))}
                />
                {isMonthly && (
                  <p className="text-[11px] text-muted-foreground">
                    Plano mensal — vencimento calculado como 30 dias após a data do pagamento.
                  </p>
                )}
              </>
            )}
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
