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

type PTStudent = {
  id?: string;
  name?: string;
  email?: string | null;
  phone?: string | null;
  birth_date?: string | null;
  goal?: string | null;
  health_notes?: string | null;
  status?: string;
  start_date?: string | null;
  notes?: string | null;
};

export function PTStudentDialog({
  open, onOpenChange, student,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  student?: PTStudent | null;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<PTStudent>({});
  useEffect(() => {
    if (open) setForm(student ?? { status: "active" });
  }, [open, student]);

  async function save() {
    if (!form.name) return toast.error("Nome obrigatório");
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;
    const payload = {
      user_id: userId,
      name: form.name,
      email: form.email ?? null,
      phone: form.phone ?? null,
      birth_date: form.birth_date || null,
      goal: form.goal ?? null,
      health_notes: form.health_notes ?? null,
      status: form.status ?? "active",
      start_date: form.start_date || null,
      notes: form.notes ?? null,
    };
    const op = form.id
      ? supabase.from("pt_students").update(payload).eq("id", form.id)
      : supabase.from("pt_students").insert(payload);
    const { error } = await op;
    if (error) return toast.error(error.message);
    toast.success(form.id ? "Aluno atualizado" : "Aluno PT criado");
    qc.invalidateQueries();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{form.id ? "Editar aluno PT" : "Novo aluno PT"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
          <div className="col-span-2 space-y-1.5">
            <Label>Nome *</Label>
            <Input value={form.name ?? ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={form.email ?? ""} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Telefone</Label>
            <Input value={form.phone ?? ""} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Data de nascimento</Label>
            <Input type="date" value={form.birth_date ?? ""} onChange={(e) => setForm((f) => ({ ...f, birth_date: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Data de início</Label>
            <Input type="date" value={form.start_date ?? ""} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status ?? "active"} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="paused">Pausado</SelectItem>
                <SelectItem value="inactive">Inativo</SelectItem>
                <SelectItem value="churned">Desligado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Objetivo</Label>
            <Textarea rows={2} value={form.goal ?? ""} onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value }))} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Observações de saúde / restrições</Label>
            <Textarea rows={2} value={form.health_notes ?? ""} onChange={(e) => setForm((f) => ({ ...f, health_notes: e.target.value }))} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Notas</Label>
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
