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
import { createPTStudentAccount } from "@/lib/pt-student-access.functions";
import { confirmDialog } from "@/lib/confirm-dialog";
import { KeyRound, Copy, Check, Eye, EyeOff, RefreshCw, ArrowRightLeft } from "lucide-react";
import { MigrateStudentsDialog } from "@/components/MigrateStudentsDialog";

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
  training_plan?: string | null;
  account_user_id?: string | null;
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
  const [migrateOpen, setMigrateOpen] = useState(false);
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
      training_plan: form.training_plan ?? null,
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{form.id ? "Editar aluno PT" : "Novo aluno PT"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label>Nome *</Label>
            <Input value={form.name ?? ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="col-span-2 space-y-1.5 sm:col-span-1">
            <Label>Email</Label>
            <Input type="email" value={form.email ?? ""} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="col-span-2 space-y-1.5 sm:col-span-1">
            <Label>Telefone</Label>
            <Input value={form.phone ?? ""} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </div>
          <div className="col-span-2 space-y-1.5 sm:col-span-1">
            <Label>Data de nascimento</Label>
            <Input type="date" value={form.birth_date ?? ""} onChange={(e) => setForm((f) => ({ ...f, birth_date: e.target.value }))} />
          </div>
          <div className="col-span-2 space-y-1.5 sm:col-span-1">
            <Label>Data de início</Label>
            <Input type="date" value={form.start_date ?? ""} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
          </div>
          <div className="col-span-2 space-y-1.5 sm:col-span-1">
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
            <Label>Notas internas</Label>
            <Textarea rows={2} value={form.notes ?? ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Plano de treino (visível para o aluno no portal)</Label>
            <Textarea
              rows={6}
              placeholder={"Ex.:\nSegunda — Peito e tríceps\n- Supino reto 4x10\n- Crucifixo inclinado 3x12\n..."}
              value={form.training_plan ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, training_plan: e.target.value }))}
            />
            <p className="text-[11px] text-muted-foreground">
              O aluno vê esse texto na aba <strong>Meu treino</strong> do portal.
            </p>
          </div>

          {form.id && (
            <div className="col-span-2 border-t pt-3 mt-2">
              <PTStudentAccessSection
                studentId={form.id}
                accountUserId={form.account_user_id ?? null}
                defaultEmail={form.email ?? ""}
              />
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

function PTStudentAccessSection({
  studentId, accountUserId, defaultEmail,
}: {
  studentId: string;
  accountUserId: string | null;
  defaultEmail: string;
}) {
  const [email, setEmail] = useState(defaultEmail);
  const [loading, setLoading] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [creds, setCreds] = useState<{ email: string; tempPassword: string } | null>(null);
  const [reveal, setReveal] = useState(false);
  const [copied, setCopied] = useState<"email" | "password" | "message" | null>(null);
  const createAccount = useServerFn(createPTStudentAccount);
  const qc = useQueryClient();

  function buildMessage(email: string, tempPassword: string) {
    return `✅ Acesso criado — envie ao aluno:
Email: ${email}
Senha temporária: ${tempPassword}
Não troque a senha ainda

📱 Acesse o Studio Coach Montanha como um app no seu celular
Assim você abre direto pelo ícone, em tela cheia, sem precisar procurar o link toda vez.
🔗 https://studiocoachmontanha.lovable.app

No Android (Chrome)
Abra o link no Chrome
Toque no menu ⋮ (canto superior direito)
Toque em Instalar app (ou "Adicionar à tela inicial")
Confirme — pronto! 🎉

No iPhone / iPad (precisa ser pelo Safari)
Abra o link no Safari
Toque no botão Compartilhar (quadrado com uma seta ↑)
Role e toque em Adicionar à Tela de Início
Toque em Adicionar — pronto! 🎉

No portal você verá suas informações pessoais e o seu plano de treino do Personal. Qualquer dúvida, me chama por aqui! 💪`;
  }

  async function loadCreds() {
    setRevealing(true);
    try {
      const { data, error } = await supabase
        .from("pt_students")
        .select("email, temp_password")
        .eq("id", studentId)
        .maybeSingle();
      if (error) throw error;
      if (!data?.temp_password) {
        toast.error("Senha temporária indisponível para este aluno");
        return;
      }
      setCreds({ email: data.email ?? "", tempPassword: data.temp_password });
      setReveal(true);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRevealing(false);
    }
  }

  async function handle() {
    if (!email.includes("@")) return toast.error("Email inválido");
    if (accountUserId && !(await confirmDialog("Gerar nova senha temporária? A senha atual será substituída."))) return;
    setLoading(true);
    try {
      const res = await createAccount({ data: { studentId, email } });
      setCreds({ email: res.email, tempPassword: res.tempPassword });
      setReveal(true);
      qc.invalidateQueries();
      toast.success(res.reset ? "Senha redefinida!" : "Acesso criado!");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function copy(kind: "email" | "password" | "message", value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  const isReset = !!accountUserId;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-muted-foreground" />
        <Label className="text-sm font-medium">
          {isReset ? "Acesso do aluno" : "Criar acesso do aluno"}
        </Label>
        {isReset && (
          <span className="ml-auto rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-success">
            Ativo
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@aluno.com"
        />
        <Button onClick={handle} disabled={loading} variant={isReset ? "outline" : "default"} className="gap-2">
          {isReset ? <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> : null}
          {loading ? (isReset ? "Redefinindo…" : "Criando…") : (isReset ? "Redefinir senha" : "Gerar acesso")}
        </Button>
      </div>

      {isReset && !creds && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={loadCreds}
          disabled={revealing}
          className="h-9 gap-2 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <Eye className="h-3.5 w-3.5" />
          {revealing ? "Carregando…" : "Ver senha atual"}
        </Button>
      )}

      {creds && (
        <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Credenciais</span>
            <Button type="button" variant="ghost" size="sm" onClick={() => setReveal((v) => !v)}>
              {reveal ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {reveal ? " Ocultar" : " Mostrar"}
            </Button>
          </div>
          <CredRow label="Email" value={creds.email} masked={false} onCopy={() => copy("email", creds.email)} copied={copied === "email"} />
          <CredRow label="Senha" value={creds.tempPassword} masked={!reveal} mono onCopy={() => copy("password", creds.tempPassword)} copied={copied === "password"} />

          <div className="mt-3 rounded-md border border-border/60 bg-background/60 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Instruções para o aluno
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => copy("message", buildMessage(creds.email, creds.tempPassword))}
                className="h-8 gap-1.5 px-2 text-xs"
              >
                {copied === "message" ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                {copied === "message" ? "Copiadas" : "Copiar instruções de acesso"}
              </Button>
            </div>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words font-sans text-[11px] leading-relaxed text-foreground">
{buildMessage(creds.email, creds.tempPassword)}
            </pre>
          </div>

          <p className="text-[11px] text-muted-foreground">
            O aluno acessa em <code>https://studiocoachmontanha.lovable.app</code> e verá as abas
            <strong> Minhas informações</strong> e <strong>Meu treino</strong>.
          </p>
        </div>
      )}
    </div>
  );
}

function CredRow({
  label, value, masked, mono, onCopy, copied,
}: {
  label: string; value: string; masked: boolean; mono?: boolean;
  onCopy: () => void; copied: boolean;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={`truncate text-sm ${mono ? "font-mono" : ""}`}>{masked ? "••••••••" : value || "—"}</div>
      </div>
      <Button type="button" variant="ghost" size="icon" onClick={onCopy} disabled={masked || !value} aria-label={`Copiar ${label}`}>
        {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );
}
