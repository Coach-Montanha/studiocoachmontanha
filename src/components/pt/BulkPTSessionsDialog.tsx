import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { Plus, Trash2 } from "lucide-react";

type Row = { date: string; time: string; duration: number; status: string };

const STATUS_OPTIONS = [
  { value: "completed", label: "✅ Realizada" },
  { value: "cancelled_student", label: "❌ Cancelada (aluno)" },
  { value: "cancelled_trainer", label: "❌ Cancelada (professor)" },
  { value: "no_show", label: "🚫 Falta" },
];

export function BulkPTSessionsDialog({
  open,
  onOpenChange,
  studentId,
  paymentId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  studentId: string;
  paymentId?: string | null;
}) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [defaultStatus, setDefaultStatus] = useState("completed");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setRows([{ date: format(new Date(), "yyyy-MM-dd"), time: "", duration: 60, status: "completed" }]);
      setDefaultStatus("completed");
    }
  }, [open]);

  function addRow() {
    const last = rows[rows.length - 1];
    setRows((r) => [...r, { date: last?.date ?? format(new Date(), "yyyy-MM-dd"), time: "", duration: 60, status: defaultStatus }]);
  }

  function updateRow(i: number, patch: Partial<Row>) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }

  function removeRow(i: number) {
    setRows((r) => r.filter((_, idx) => idx !== i));
  }

  function applyStatusToAll() {
    setRows((r) => r.map((row) => ({ ...row, status: defaultStatus })));
  }

  async function save() {
    if (rows.length === 0) return;
    const invalid = rows.find((r) => !r.date);
    if (invalid) return toast.error("Todas as linhas precisam ter data");
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;
    setSaving(true);
    const payload = rows.map((r) => ({
      user_id: userId,
      pt_student_id: studentId,
      pt_payment_id: paymentId ?? null,
      session_date: r.date,
      session_time: r.time || null,
      duration_minutes: r.duration || 60,
      status: r.status,
    }));
    const { error } = await supabase.from("pt_sessions").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`${rows.length} aula(s) registrada(s)`);
    qc.invalidateQueries();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Registrar aulas em lote</DialogTitle>
          <p className="text-xs text-muted-foreground">
            Registre várias aulas passadas de uma vez. Útil para histórico de aulas já efetuadas (ou não).
          </p>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-2 rounded-lg border bg-muted/30 p-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Status padrão</Label>
            <Select value={defaultStatus} onValueChange={setDefaultStatus}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" variant="outline" onClick={applyStatusToAll}>Aplicar a todas</Button>
          <div className="ml-auto">
            <Button size="sm" variant="outline" onClick={addRow}><Plus className="h-4 w-4" /> Adicionar linha</Button>
          </div>
        </div>

        <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-12 items-end gap-2 rounded-lg border p-2">
              <div className="col-span-4 space-y-1">
                <Label className="text-xs">Data</Label>
                <Input type="date" value={r.date} onChange={(e) => updateRow(i, { date: e.target.value })} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Hora</Label>
                <Input type="time" value={r.time} onChange={(e) => updateRow(i, { time: e.target.value })} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Duração</Label>
                <Input type="number" value={r.duration} onChange={(e) => updateRow(i, { duration: Number(e.target.value) })} />
              </div>
              <div className="col-span-3 space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={r.status} onValueChange={(v) => updateRow(i, { status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-1 flex justify-end">
                <Button size="icon" variant="ghost" onClick={() => removeRow(i)} disabled={rows.length === 1}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Salvando…" : `Registrar ${rows.length} aula(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
