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
import { format } from "date-fns";
import { Calendar } from "lucide-react";
import { addSessionToCalendar } from "@/lib/gcal";


type PTSession = {
  id?: string;
  pt_student_id?: string;
  pt_payment_id?: string | null;
  session_date?: string;
  session_time?: string | null;
  duration_minutes?: number;
  status?: string;
  exercises?: string | null;
  performance_notes?: string | null;
  next_session_plan?: string | null;
};

export function PTSessionDialog({
  open, onOpenChange, session, defaultStudentId, defaultDate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  session?: PTSession | null;
  defaultStudentId?: string;
  defaultDate?: string;
}) {
  const qc = useQueryClient();
  const { data: students = [] } = useQuery({
    queryKey: ["pt-students-all"],
    queryFn: async () => (await supabase.from("pt_students").select("id,name").order("name")).data ?? [],
  });

  const [form, setForm] = useState<PTSession>({});
  const [addingToCalendar, setAddingToCalendar] = useState(false);
  useEffect(() => {
    if (open) {
      setForm(session ?? {
        pt_student_id: defaultStudentId,
        session_date: defaultDate ?? format(new Date(), "yyyy-MM-dd"),
        session_time: "08:00",
        duration_minutes: 60,
        status: "completed",
      });
    }
  }, [open, session, defaultStudentId, defaultDate]);

  const { data: payments = [] } = useQuery({
    queryKey: ["pt-student-payments-select", form.pt_student_id],
    queryFn: async () => {
      if (!form.pt_student_id) return [];
      const { data: pays } = await supabase
        .from("pt_payments")
        .select("id,reference_month,payment_date,amount,sessions_paid,status,pt_plans(name,sessions_per_month,package_sessions,billing_type)")
        .eq("pt_student_id", form.pt_student_id)
        .eq("status", "paid")
        .order("payment_date", { ascending: true });

      if (!pays?.length) return [];

      const { data: sessions } = await supabase
        .from("pt_sessions")
        .select("id,pt_payment_id,status")
        .eq("pt_student_id", form.pt_student_id)
        .eq("status", "completed")
        .not("pt_payment_id", "is", null);

      const sessionsByPayment = new Map<string, number>();
      for (const s of sessions ?? []) {
        if (!s.pt_payment_id) continue;
        sessionsByPayment.set(
          s.pt_payment_id,
          (sessionsByPayment.get(s.pt_payment_id) ?? 0) + 1,
        );
      }

      return pays.map((p: any) => {
        const contracted =
          p.sessions_paid ??
          p.pt_plans?.sessions_per_month ??
          p.pt_plans?.package_sessions ??
          null;
        const used = sessionsByPayment.get(p.id) ?? 0;
        const remaining = contracted !== null ? contracted - used : null;
        const isFull = remaining !== null && remaining <= 0;
        return { ...p, contracted, used, remaining, isFull };
      });
    },
    enabled: !!form.pt_student_id,
  });

  const selectedPayment = payments.find((p: any) => p.id === form.pt_payment_id);
  const selectedBalance = selectedPayment
    ? {
        contracted: selectedPayment.contracted,
        used: selectedPayment.used,
        remaining: selectedPayment.remaining,
        isFull: selectedPayment.isFull,
      }
    : null;

  useEffect(() => {
    if (!form.pt_student_id || form.pt_payment_id || !payments.length) return;
    const available = payments.filter((p: any) => !p.isFull);
    if (available.length > 0) {
      setForm((f) => ({ ...f, pt_payment_id: available[0].id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payments, form.pt_student_id]);


  async function save() {
    if (!form.pt_student_id || !form.session_date) return toast.error("Aluno e data obrigatórios");
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;
    const payload = {
      user_id: userId,
      pt_student_id: form.pt_student_id,
      pt_payment_id: form.pt_payment_id || null,
      session_date: form.session_date,
      session_time: form.session_time || null,
      duration_minutes: form.duration_minutes ?? 60,
      status: form.status ?? "completed",
      exercises: form.exercises ?? null,
      performance_notes: form.performance_notes ?? null,
      next_session_plan: form.next_session_plan ?? null,
    };
    const op = form.id
      ? supabase.from("pt_sessions").update(payload).eq("id", form.id)
      : supabase.from("pt_sessions").insert(payload);
    const { error } = await op;
    if (error) return toast.error(error.message);
    toast.success(form.id ? "Aula atualizada" : "Aula registrada");
    qc.invalidateQueries();
    onOpenChange(false);
  }

  async function saveAndAddToCalendar() {
    await save();
    if (!form.session_date || !form.session_time || !form.pt_student_id) return;
    const student = students.find((s) => s.id === form.pt_student_id);
    if (!student) return;
    setAddingToCalendar(true);
    const ok = await addSessionToCalendar({
      studentName: student.name,
      sessionDate: form.session_date,
      sessionTime: form.session_time,
      durationMinutes: form.duration_minutes ?? 60,
    });
    setAddingToCalendar(false);
    if (ok) toast.success("Aula adicionada ao Google Calendar!");
    else toast.error("Erro ao adicionar ao Calendar. Verifique as configurações.");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{form.id ? "Editar aula" : "Registrar nova aula"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 max-h-[65vh] overflow-y-auto pr-1">
          <div className="col-span-2 space-y-1.5">
            <Label>Aluno *</Label>
            <Select value={form.pt_student_id} onValueChange={(v) => setForm((f) => ({ ...f, pt_student_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {students.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Data *</Label>
            <Input type="date" value={form.session_date ?? ""} onChange={(e) => setForm((f) => ({ ...f, session_date: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Horário</Label>
            <Input type="time" value={form.session_time ?? ""} onChange={(e) => setForm((f) => ({ ...f, session_time: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Duração</Label>
            <Select value={String(form.duration_minutes ?? 60)} onValueChange={(v) => setForm((f) => ({ ...f, duration_minutes: Number(v) }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="45">45 min</SelectItem>
                <SelectItem value="60">60 min</SelectItem>
                <SelectItem value="90">90 min</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status ?? "completed"} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="completed">✅ Realizada</SelectItem>
                <SelectItem value="cancelled_student">❌ Cancelada pelo aluno</SelectItem>
                <SelectItem value="cancelled_trainer">❌ Cancelada pelo professor</SelectItem>
                <SelectItem value="no_show">🚫 Falta sem aviso</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Vincular pagamento</Label>
            <Select value={form.pt_payment_id ?? "none"} onValueChange={(v) => setForm((f) => ({ ...f, pt_payment_id: v === "none" ? null : v }))}>
              <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {payments.map((p: any) => {
                  const dateLabel = p.payment_date
                    ? new Date(p.payment_date + "T12:00").toLocaleDateString("pt-BR")
                    : "—";
                  const balanceLabel =
                    p.contracted !== null
                      ? ` · ${p.used}/${p.contracted} aulas${p.isFull ? " 🔴 ESGOTADO" : ` · ${p.remaining} restantes`}`
                      : "";
                  return (
                    <SelectItem key={p.id} value={p.id}>
                      {dateLabel} · R$ {Number(p.amount).toFixed(2)}{balanceLabel}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            {selectedBalance && selectedBalance.contracted !== null && (
              <div className={`mt-2 rounded-lg border p-3 text-xs ${selectedBalance.isFull ? "border-destructive/40 bg-destructive/10" : "border-emerald-300/50 bg-emerald-50 dark:bg-emerald-950/30"}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {selectedBalance.isFull ? "⚠️ Limite de sessões atingido" : "✅ Saldo do pagamento"}
                  </span>
                  <span className="font-mono">
                    {selectedBalance.used}/{selectedBalance.contracted} aulas
                  </span>
                </div>
                {!selectedBalance.isFull && (
                  <div className="mt-2">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-emerald-500 transition-all"
                        style={{ width: `${Math.min(100, (selectedBalance.used / selectedBalance.contracted) * 100)}%` }}
                      />
                    </div>
                    <div className="mt-1 text-muted-foreground">
                      {selectedBalance.remaining} aula(s) restante(s) neste pagamento
                    </div>
                  </div>
                )}
                {selectedBalance.isFull && (
                  <p className="mt-1 text-destructive">
                    Esta sessão será registrada além do limite contratado. Vincule a um novo pagamento ou registre sem vínculo.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="col-span-2 space-y-1.5">
            <Label>Exercícios realizados</Label>
            <Textarea rows={2} value={form.exercises ?? ""} onChange={(e) => setForm((f) => ({ ...f, exercises: e.target.value }))} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Observações de performance</Label>
            <Textarea rows={2} value={form.performance_notes ?? ""} onChange={(e) => setForm((f) => ({ ...f, performance_notes: e.target.value }))} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Plano para próxima aula</Label>
            <Textarea rows={2} value={form.next_session_plan ?? ""} onChange={(e) => setForm((f) => ({ ...f, next_session_plan: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="outline" onClick={saveAndAddToCalendar} disabled={addingToCalendar}>
            <Calendar className="mr-2 h-4 w-4" />
            {addingToCalendar ? "Adicionando…" : "Salvar + Google Calendar"}
          </Button>
          <Button onClick={save}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
