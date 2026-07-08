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
import { useServerFn } from "@tanstack/react-start";
import { createStudentAccount } from "@/lib/student-access.functions";
import { KeyRound, Info } from "lucide-react";


type Student = {
  id?: string;
  name?: string;
  email?: string | null;
  phone?: string | null;
  status?: string;
  notes?: string | null;
  plan_id?: string | null;
  birth_date?: string | null;
  account_user_id?: string | null;
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
    // Plano vinculado é definido automaticamente através dos pagamentos registrados.


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
            <Label>Data de nascimento</Label>
            <Input
              type="date"
              value={form.birth_date ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, birth_date: e.target.value }))}
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

          {form.id && (
            <div className="col-span-2 border-t pt-3 mt-2">
              <StudentAccessSection studentId={form.id} accountUserId={form.account_user_id ?? null} defaultEmail={form.email ?? ""} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StudentAccessSection({ studentId, accountUserId, defaultEmail }: { studentId: string; accountUserId: string | null; defaultEmail: string }) {
  const [email, setEmail] = useState(defaultEmail);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ email: string; tempPassword: string } | null>(null);
  const createAccount = useServerFn(createStudentAccount);
  const qc = useQueryClient();

  if (accountUserId) {
    return (
      <div className="text-sm text-emerald-600 flex items-center gap-2">
        <KeyRound className="h-4 w-4" /> Acesso do aluno já criado
      </div>
    );
  }

  async function handle() {
    if (!email.includes("@")) return toast.error("Email inválido");
    setLoading(true);
    try {
      const res = await createAccount({ data: { studentId, email } });
      setResult(res);
      qc.invalidateQueries();
      toast.success("Acesso criado!");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="rounded-md border border-emerald-400/40 bg-emerald-50 dark:bg-emerald-950/30 p-3 text-sm space-y-1">
        <div className="font-semibold text-emerald-700 dark:text-emerald-400">✅ Acesso criado — envie ao aluno:</div>
        <div><span className="text-muted-foreground">Email:</span> <code>{result.email}</code></div>
        <div><span className="text-muted-foreground">Senha temporária:</span> <code className="font-mono">{result.tempPassword}</code></div>
        <div className="text-xs text-muted-foreground pt-1">O aluno pode trocar a senha após entrar.</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> Criar acesso do aluno</Label>
      <div className="flex gap-2">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@aluno.com" />
        <Button onClick={handle} disabled={loading}>{loading ? "Criando…" : "Gerar acesso"}</Button>
      </div>
      <p className="text-xs text-muted-foreground">Gera login e senha temporária para o aluno acessar o portal.</p>
    </div>
  );
}
