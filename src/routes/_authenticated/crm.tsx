import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Send, Mail, Phone } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import { sendEmail } from "@/lib/email.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StudentStatusBadge } from "@/components/edufinance/Badges";

export const Route = createFileRoute("/_authenticated/crm")({
  head: () => ({ meta: [{ title: "CRM — EduFinance" }] }),
  component: CRMPage,
});

type Student = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
};

function CRMPage() {
  const { data: students = [] } = useQuery({
    queryKey: ["crm-students"],
    queryFn: async () => {
      const { data } = await supabase
        .from("students")
        .select("id,name,email,phone,status")
        .order("name");
      return (data ?? []) as Student[];
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">CRM</h1>
        <p className="text-sm text-muted-foreground">
          Comunique-se com seus alunos por email, WhatsApp ou SMS
        </p>
      </div>

      <Tabs defaultValue="individual" className="space-y-4">
        <TabsList>
          <TabsTrigger value="individual">Mensagem Individual</TabsTrigger>
          <TabsTrigger value="bulk">Disparo em Massa</TabsTrigger>
        </TabsList>

        <TabsContent value="individual">
          <IndividualMessage students={students} />
        </TabsContent>

        <TabsContent value="bulk">
          <BulkMessage students={students} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function IndividualMessage({ students }: { students: Student[] }) {
  const [studentId, setStudentId] = useState("");
  const [channel, setChannel] = useState<"email" | "whatsapp" | "sms">("email");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const student = students.find((s) => s.id === studentId);

  async function send() {
    if (!student) return toast.error("Selecione um aluno.");
    if (!message.trim()) return toast.error("Digite uma mensagem.");

    const personalizedMessage = message.replace(/\{nome\}/gi, student.name);

    if (channel === "email") {
      if (!student.email) return toast.error("Este aluno não tem email cadastrado.");
      setSending(true);
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("edufinance.resendKey") ?? ""}`,
          },
          body: JSON.stringify({
            from: localStorage.getItem("edufinance.senderEmail") ?? "noreply@seudominio.com",
            to: [student.email],
            subject: subject || "Mensagem da sua academia",
            text: personalizedMessage,
          }),
        });
        if (res.ok) {
          toast.success(`Email enviado para ${student.name}!`);
          setMessage("");
          setSubject("");
        } else {
          const err = await res.json().catch(() => ({}));
          toast.error(`Erro ao enviar email: ${err.message ?? "verifique sua API key Resend"}`);
        }
      } catch {
        toast.error("Erro de rede ao enviar email.");
      }
      setSending(false);
      return;
    }

    if (channel === "whatsapp") {
      if (!student.phone) return toast.error("Este aluno não tem telefone cadastrado.");
      const phone = student.phone.replace(/\D/g, "");
      window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(personalizedMessage)}`, "_blank");
      toast.success("WhatsApp aberto com a mensagem pré-preenchida.");
      return;
    }

    if (channel === "sms") {
      if (!student.phone) return toast.error("Este aluno não tem telefone cadastrado.");
      const phone = student.phone.replace(/\D/g, "");
      window.open(`sms:+55${phone}?body=${encodeURIComponent(personalizedMessage)}`, "_blank");
      toast.success("Aplicativo de SMS aberto.");
      return;
    }
  }


  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <Card className="p-5 space-y-4">
        <h2 className="text-sm font-semibold">Destinatário e canal</h2>

        <div className="space-y-1.5">
          <Label>Aluno</Label>
          <Select value={studentId} onValueChange={setStudentId}>
            <SelectTrigger><SelectValue placeholder="Selecione um aluno" /></SelectTrigger>
            <SelectContent>
              {students.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}{s.email ? ` · ${s.email}` : ""}{s.phone ? ` · ${s.phone}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {student && (
          <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
            <div className="font-medium">{student.name}</div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Mail className="h-3.5 w-3.5" /> {student.email ?? "Sem email"}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Phone className="h-3.5 w-3.5" /> {student.phone ?? "Sem telefone"}
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label>Canal</Label>
          <div className="flex gap-2">
            {(["email", "whatsapp", "sms"] as const).map((c) => (
              <Button
                key={c}
                type="button"
                variant={channel === c ? "default" : "outline"}
                size="sm"
                onClick={() => setChannel(c)}
              >
                {c === "email" ? "📧 Email" : c === "whatsapp" ? "💬 WhatsApp" : "📱 SMS"}
              </Button>
            ))}
          </div>
        </div>

        {channel === "email" && (
          <div className="space-y-1.5">
            <Label>Assunto</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ex: Lembrete de pagamento" />
          </div>
        )}

        <div className="space-y-1.5">
          <Label>Mensagem</Label>
          <Textarea
            rows={8}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Digite sua mensagem aqui…"
          />
        </div>

        {student && message.includes("{nome}") && (
          <div className="rounded-lg border border-dashed bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">
              👁️ Prévia com o nome do aluno:
            </p>
            <p className="text-sm whitespace-pre-wrap">
              {message.replace(/\{nome\}/gi, student.name)}
            </p>
          </div>
        )}


        <Button onClick={send} disabled={sending} className="w-full">
          <Send className="mr-2 h-4 w-4" />
          {sending ? "Enviando…" : channel === "email" ? "Enviar email" : channel === "whatsapp" ? "Abrir WhatsApp" : "Abrir SMS"}
        </Button>
      </Card>

      <TemplatesPanel onSelect={setMessage} />
    </div>
  );
}

function BulkMessage({ students }: { students: Student[] }) {
  const [filterStatus, setFilterStatus] = useState("all");
  const [channel, setChannel] = useState<"email" | "whatsapp" | "sms">("email");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<{ name: string; ok: boolean; reason?: string }[]>([]);

  const filtered = useMemo(
    () => students.filter((s) => filterStatus === "all" || s.status === filterStatus),
    [students, filterStatus],
  );

  const allSelected = filtered.length > 0 && selected.size === filtered.length;

  async function sendBulk() {
    if (selected.size === 0) return toast.error("Selecione pelo menos um aluno.");
    if (!message.trim()) return toast.error("Digite uma mensagem.");
    setSending(true);
    setResults([]);

    const targets = students.filter((s) => selected.has(s.id));
    const res: typeof results = [];

    for (const s of targets) {
      if (channel === "email") {
        if (!s.email) { res.push({ name: s.name, ok: false, reason: "sem email" }); continue; }
        try {
          const r = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("edufinance.resendKey") ?? ""}`,
            },
            body: JSON.stringify({
              from: localStorage.getItem("edufinance.senderEmail") ?? "noreply@seudominio.com",
              to: [s.email],
              subject: subject || "Mensagem da sua academia",
              text: message.replace(/\{nome\}/gi, s.name),
            }),
          });
          res.push({ name: s.name, ok: r.ok, reason: r.ok ? undefined : "erro API" });
        } catch {
          res.push({ name: s.name, ok: false, reason: "erro de rede" });
        }
        await new Promise((r) => setTimeout(r, 200));
      } else if (channel === "whatsapp") {
        if (!s.phone) { res.push({ name: s.name, ok: false, reason: "sem telefone" }); continue; }
        const phone = s.phone.replace(/\D/g, "");
        window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(message.replace(/\{nome\}/gi, s.name))}`, "_blank");
        res.push({ name: s.name, ok: true });
        await new Promise((r) => setTimeout(r, 800));
      } else {
        if (!s.phone) { res.push({ name: s.name, ok: false, reason: "sem telefone" }); continue; }
        const phone = s.phone.replace(/\D/g, "");
        window.open(`sms:+55${phone}?body=${encodeURIComponent(message.replace(/\{nome\}/gi, s.name))}`, "_blank");
        res.push({ name: s.name, ok: true });
        await new Promise((r) => setTimeout(r, 800));
      }
    }

    setResults(res);
    setSending(false);
    const ok = res.filter((r) => r.ok).length;
    toast.success(`${ok} mensagem(ns) enviada(s).`);
  }

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-4">
        <h2 className="text-sm font-semibold">Configurar disparo</h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Filtrar alunos por status</Label>
            <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setSelected(new Set()); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="inactive">Inativos</SelectItem>
                <SelectItem value="churned">Desligados (Churn)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Canal</Label>
            <div className="flex gap-2">
              {(["email", "whatsapp", "sms"] as const).map((c) => (
                <Button key={c} type="button" variant={channel === c ? "default" : "outline"} size="sm" onClick={() => setChannel(c)}>
                  {c === "email" ? "📧" : c === "whatsapp" ? "💬" : "📱"} {c}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {channel === "email" && (
          <div className="space-y-1.5">
            <Label>Assunto</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Assunto do email" />
          </div>
        )}

        <div className="space-y-1.5">
          <Label>Mensagem (use {"{nome}"} para personalizar)</Label>
          <Textarea
            rows={6}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={`Olá {nome}, tudo bem?\n\nSua mensagem aqui…`}
          />
        </div>

        <Button onClick={sendBulk} disabled={sending || selected.size === 0} className="w-full">
          <Send className="mr-2 h-4 w-4" />
          {sending ? "Enviando…" : `Enviar para ${selected.size} aluno(s)`}
        </Button>

        {channel !== "email" && (
          <p className="text-xs text-muted-foreground">
            💡 Para WhatsApp e SMS em massa, o app abrirá uma janela por aluno. Recomendamos selecionar até 5 por vez.
          </p>
        )}
      </Card>

      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            Selecionar alunos ({selected.size} de {filtered.length})
          </h2>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              setSelected(allSelected ? new Set() : new Set(filtered.map((s) => s.id)))
            }
          >
            {allSelected ? "Desmarcar todos" : "Selecionar todos"}
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => setSelected(e.target.checked ? new Set(filtered.map((s) => s.id)) : new Set())}
                />
              </TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Telefone</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((s) => (
              <TableRow
                key={s.id}
                className="cursor-pointer"
                onClick={() =>
                  setSelected((prev) => {
                    const n = new Set(prev);
                    if (n.has(s.id)) n.delete(s.id);
                    else n.add(s.id);
                    return n;
                  })
                }
              >
                <TableCell>
                  <input type="checkbox" checked={selected.has(s.id)} onChange={() => {}} />
                </TableCell>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell><StudentStatusBadge status={s.status} /></TableCell>
                <TableCell className="text-xs text-muted-foreground">{s.email ?? "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{s.phone ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {results.length > 0 && (
        <Card className="p-5 space-y-2">
          <h2 className="text-sm font-semibold">Resultado do disparo</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aluno</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Detalhe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>
                    <span className={r.ok ? "text-emerald-600 font-medium" : "text-destructive font-medium"}>
                      {r.ok ? "✅ Enviado" : "❌ Falhou"}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.reason ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

const TEMPLATES = [
  { label: "💰 Lembrete de pagamento", text: "Olá {nome}! Passando para lembrar que sua mensalidade está próxima do vencimento. Qualquer dúvida, estou à disposição!" },
  { label: "😊 Boas-vindas", text: "Olá {nome}, seja muito bem-vindo(a)! Estamos felizes em ter você conosco. Qualquer dúvida, é só chamar." },
  { label: "📅 Confirmar aula", text: "Oi {nome}! Confirma presença na aula de amanhã? Te espero!" },
  { label: "🔄 Aluno inativo", text: "Olá {nome}, sentimos sua falta! Que tal retomar os treinos? Entre em contato e vamos combinar." },
  { label: "🎉 Parabéns", text: "Feliz aniversário, {nome}! 🎂 Desejamos um dia incrível e muito sucesso na sua jornada!" },
  { label: "📢 Aviso geral", text: "Olá {nome}! Temos um aviso importante para você. Por favor, entre em contato o quanto antes." },
];

function TemplatesPanel({ onSelect }: { onSelect: (text: string) => void }) {
  return (
    <Card className="p-5 space-y-3">
      <h2 className="text-sm font-semibold">Modelos de mensagem</h2>
      <p className="text-xs text-muted-foreground">Clique para usar um modelo como base.</p>
      <div className="space-y-2">
        {TEMPLATES.map((t) => (
          <button
            key={t.label}
            onClick={() => onSelect(t.text)}
            className="w-full rounded-lg border p-3 text-left text-sm transition-colors hover:bg-accent"
          >
            <div className="font-medium">{t.label}</div>
            <div className="mt-0.5 truncate text-xs text-muted-foreground">{t.text.slice(0, 80)}…</div>
          </button>
        ))}
      </div>
    </Card>
  );
}
