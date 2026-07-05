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

type Student = {
  id?: string;
  name?: string;
  email?: string | null;
  phone?: string | null;
  status?: string;
  notes?: string | null;
  plan_id?: string | null;
  birth_date?: string | null;
};

export function StudentDialog({
  open,
  onOpenChange,
  student,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  student?: Student | null;
}) {
  const qc = useQueryClient();
  const { data: plans = [] } = useQuery({
    queryKey: ["plans-all"],
    queryFn: async () => {
      const { data } = await supabase.from("plans").select("id,name").order("name");
      return data ?? [];
    },
  });

  const [form, setForm] = useState<Student>({});
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
      status: form.status ?? "active",
      notes: form.notes ?? null,
      birth_date: form.birth_date ?? null,
    };
    let studentId = form.id;
    if (form.id) {
      const { error } = await supabase.from("students").update(payload).eq("id", form.id);
      if (error) return toast.error(error.message);
    } else {
      const { data, error } = await supabase
        .from("students")
        .insert(payload)
        .select("id")
        .single();
      if (error) return toast.error(error.message);
      studentId = data.id;
    }
    if (form.plan_id && studentId) {
      await supabase
        .from("student_plan_history")
        .update({ is_current: false })
        .eq("student_id", studentId);
      await supabase.from("student_plan_history").insert({
        user_id: userId,
        student_id: studentId,
        plan_id: form.plan_id,
        start_date: new Date().toISOString().slice(0, 10),
        is_current: true,
      });
    }

    toast.success(form.id ? "Aluno atualizado" : "Aluno criado");
    qc.invalidateQueries();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{form.id ? "Editar aluno" : "Novo aluno"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label>Nome *</Label>
            <Input
              value={form.name ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input
              type="email"
              value={form.email ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Telefone</Label>
            <Input
              value={form.phone ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status ?? "active"} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="inactive">Inativo</SelectItem>
                <SelectItem value="churned">Desligado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Plano atual</Label>
            <Select
              value={form.plan_id ?? "none"}
              onValueChange={(v) => setForm((f) => ({ ...f, plan_id: v === "none" ? null : v }))}
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
