import { useEffect, useState } from "react";
import { confirmDialog } from "@/lib/confirm-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { createStudentAccount } from "@/lib/student-access.functions";
import { KeyRound, Info, Eye, EyeOff, Copy, Check, RefreshCw, ArrowRightLeft, Receipt } from "lucide-react";
import { MigrateStudentsDialog } from "@/components/MigrateStudentsDialog";
import { PaymentStatusBadge } from "@/components/edufinance/Badges";
import { formatBRL, formatDateBR, formatMonthLabel } from "@/lib/format";

function formatPhoneBR(input: string) {
  const d = (input ?? "").replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}


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
  attendance_offset?: number | null;
  cpf?: string | null;
  rg?: string | null;
  start_date?: string | null;
  address?: string | null;
  postal_code?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
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
      status: form.status ?? "active",
      notes: form.notes ?? null,
      birth_date: form.birth_date ?? null,
      attendance_offset: Math.max(0, Math.floor(Number(form.attendance_offset ?? 0) || 0)),
      cpf: form.cpf ?? null,
      rg: form.rg ?? null,
      start_date: form.start_date ?? null,
      address: form.address ?? null,
      postal_code: form.postal_code ?? null,
      neighborhood: form.neighborhood ?? null,
      city: form.city ?? null,
      state: form.state ?? null,
      country: form.country ?? null,
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
          <DialogDescription>
            {form.id
              ? "Atualize os dados cadastrais e o acesso do aluno."
              : "Preencha os dados básicos. O restante pode ser completado depois."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <FormSection divided={false}>
            <Field label="Nome *" full>
              <Input
                value={form.name ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={form.email ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </Field>
            <Field label="Telefone" hint="DDD + número. Aceita fixo ou celular.">
              <Input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="(11) 98765-4321"
                value={form.phone ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, phone: formatPhoneBR(e.target.value) }))}
              />
            </Field>
            <Field label="Data de nascimento">
              <Input
                type="date"
                value={form.birth_date ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, birth_date: e.target.value }))}
              />
            </Field>
            <Field label="Status">
              <Select value={form.status ?? "active"} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                  <SelectItem value="churned">Desligado</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field full>
              <div className="text-caption flex gap-2.5 rounded-lg border border-dashed border-border bg-surface-sunken p-3 text-muted-foreground">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>
                  O plano do aluno é definido automaticamente a partir dos pagamentos registrados. Para vincular ou alterar o plano, registre um pagamento na aba <strong className="font-semibold text-foreground">Pagamentos</strong>.
                </span>
              </div>
            </Field>
            <Field
              label="Aulas já realizadas (histórico anterior)"
              hint="Use para importar contagens de aulas feitas em outro sistema. Esse valor é somado às aulas registradas aqui."
              full
            >
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={form.attendance_offset ?? 0}
                onChange={(e) => setForm((f) => ({ ...f, attendance_offset: e.target.value === "" ? 0 : Math.max(0, Math.floor(Number(e.target.value))) }))}
              />
            </Field>
          </FormSection>

          <FormSection title="Informações pessoais (opcional)">
            <Field label="CPF">
              <Input
                value={form.cpf ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, cpf: e.target.value }))}
              />
            </Field>
            <Field label="RG">
              <Input
                value={form.rg ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, rg: e.target.value }))}
              />
            </Field>
            <Field label="Data de início" full>
              <Input
                type="date"
                value={form.start_date ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
              />
            </Field>
          </FormSection>

          <FormSection title="Endereço (opcional)">
            <Field label="Endereço" full>
              <Input
                placeholder="Rua, número, complemento"
                value={form.address ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              />
            </Field>
            <Field label="CEP">
              <Input
                value={form.postal_code ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, postal_code: e.target.value }))}
              />
            </Field>
            <Field label="Bairro">
              <Input
                value={form.neighborhood ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, neighborhood: e.target.value }))}
              />
            </Field>
            <Field label="Cidade">
              <Input
                value={form.city ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              />
            </Field>
            <Field label="Estado">
              <Input
                value={form.state ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
              />
            </Field>
            <Field label="País" full>
              <Input
                value={form.country ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
              />
            </Field>
          </FormSection>

          <FormSection title="Notas">
            <Field full>
              <Textarea
                rows={3}
                value={form.notes ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </Field>
          </FormSection>

          {form.id && (
            <div className="border-t border-border pt-4">
              <StudentPaymentsSection studentId={form.id} />
            </div>
          )}

          {form.id && (
            <div className="border-t border-border pt-4">
              <StudentAccessSection studentId={form.id} accountUserId={form.account_user_id ?? null} defaultEmail={form.email ?? ""} />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <div>
            {form.id && (
              <Button variant="outline" onClick={() => setMigrateOpen(true)} className="w-full gap-2 sm:w-auto">
                <ArrowRightLeft className="h-4 w-4" />
                Migrar para PT
              </Button>
            )}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </div>
        </DialogFooter>

      </DialogContent>
      {form.id && (
        <MigrateStudentsDialog
          open={migrateOpen}
          onOpenChange={setMigrateOpen}
          ids={[form.id]}
          direction="studio_to_pt"
          onDone={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  );
}

function StudentAccessSection({ studentId, accountUserId, defaultEmail }: { studentId: string; accountUserId: string | null; defaultEmail: string }) {
  const [email, setEmail] = useState(defaultEmail);
  const [loading, setLoading] = useState(false);
  const [creds, setCreds] = useState<{ email: string; tempPassword: string } | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [copied, setCopied] = useState<"email" | "password" | "message" | null>(null);
  const createAccount = useServerFn(createStudentAccount);
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

Depois é só usar seu e-mail e senha para entrar. Qualquer dúvida, me chama por aqui! 💪`;
  }



  async function loadCreds() {
    setRevealing(true);
    try {
      const { data, error } = await supabase
        .rpc("get_student_credentials", { _student_id: studentId })
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

  async function copy(kind: "email" | "password" | "message", value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error("Não foi possível copiar");
    }
  }


  async function handle() {
    if (!email.includes("@")) return toast.error("Email inválido");
    if (accountUserId && !(await confirmDialog("Gerar uma nova senha temporária? A senha atual do aluno será substituída."))) return;
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
          className="h-11 sm:h-10"
        />
        <Button
          onClick={handle}
          disabled={loading}
          variant={isReset ? "outline" : "default"}
          className="h-11 gap-2 transition-all duration-200 sm:h-10"
        >
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
          className="h-9 gap-2 px-2 text-xs text-muted-foreground transition-colors duration-200 hover:text-foreground"
        >
          <Eye className="h-3.5 w-3.5" />
          {revealing ? "Carregando…" : "Ver senha atual"}
        </Button>
      )}

      {creds && (
        <div className="rounded-lg border border-border/60 bg-gradient-to-br from-card via-card to-muted/30 p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Credenciais do aluno
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setReveal((v) => !v)}
              className="h-8 gap-1.5 px-2 text-xs transition-colors duration-200"
            >
              {reveal ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {reveal ? "Ocultar" : "Mostrar"}
            </Button>
          </div>

          <div className="space-y-2.5">
            <CredRow
              label="Email"
              value={creds.email}
              masked={false}
              onCopy={() => copy("email", creds.email)}
              copied={copied === "email"}
            />
            <CredRow
              label="Senha temporária"
              value={creds.tempPassword}
              masked={!reveal}
              mono
              onCopy={() => copy("password", creds.tempPassword)}
              copied={copied === "password"}
            />
          </div>

          <div className="mt-4 rounded-md border border-border/60 bg-background/60 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Mensagem para o aluno
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => copy("message", buildMessage(creds.email, creds.tempPassword))}
                className="h-8 gap-1.5 px-2 text-xs"
              >
                {copied === "message" ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                {copied === "message" ? "Copiada" : "Copiar mensagem"}
              </Button>
            </div>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words font-sans text-[11px] leading-relaxed text-foreground">
{buildMessage(creds.email, creds.tempPassword)}
            </pre>
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            O aluno pode alterar a senha após entrar. Esta senha fica armazenada aqui como referência até uma próxima redefinição.
          </p>

        </div>
      )}

      {!isReset && !creds && (
        <p className="text-xs text-muted-foreground">
          Gera login e senha temporária para o aluno acessar o portal.
        </p>
      )}
    </div>
  );
}

function CredRow({
  label, value, masked, mono, onCopy, copied,
}: {
  label: string;
  value: string;
  masked: boolean;
  mono?: boolean;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div className="group flex items-center gap-2 rounded-md border border-border/50 bg-background/60 px-3 py-2 transition-colors duration-200 hover:border-border">
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={`truncate text-sm text-foreground ${mono ? "font-mono tracking-wider" : ""}`}>
          {masked ? "••••••••" : value || "—"}
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onCopy}
        disabled={masked || !value}
        aria-label={`Copiar ${label}`}
        className="h-9 w-9 shrink-0 transition-all duration-200 hover:bg-primary/10 hover:text-primary disabled:opacity-40"
      >
        {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );
}

function StudentPaymentsSection({ studentId }: { studentId: string }) {
  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["student-dialog-payments", studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("id,amount,payment_date,reference_month,status,plans(name)")
        .eq("student_id", studentId)
        .order("payment_date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const total = payments
    .filter((p: any) => p.status === "paid")
    .reduce((s: number, p: any) => s + Number(p.amount), 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm font-medium">Pagamentos anteriores</Label>
        </div>
        {payments.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {payments.length} registro{payments.length === 1 ? "" : "s"} · Total pago:{" "}
            <span className="font-mono font-medium text-foreground">{formatBRL(total)}</span>
          </span>
        )}
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando…</p>
      ) : payments.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum pagamento registrado.</p>
      ) : (
        <div className="max-h-56 overflow-y-auto rounded-md border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted/60 text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium">Data</th>
                <th className="px-2 py-1.5 text-left font-medium">Referência</th>
                <th className="px-2 py-1.5 text-left font-medium">Plano</th>
                <th className="px-2 py-1.5 text-right font-medium">Valor</th>
                <th className="px-2 py-1.5 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p: any) => (
                <tr key={p.id} className="border-t">
                  <td className="px-2 py-1.5 font-mono">{formatDateBR(p.payment_date)}</td>
                  <td className="px-2 py-1.5">{p.reference_month ? formatMonthLabel(p.reference_month) : "—"}</td>
                  <td className="px-2 py-1.5">{p.plans?.name ?? "—"}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{formatBRL(p.amount)}</td>
                  <td className="px-2 py-1.5"><PaymentStatusBadge status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


