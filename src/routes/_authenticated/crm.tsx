import { MessageSquare as PageIcon } from "lucide-react";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Send, Mail, Phone, Bell } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import { sendEmail } from "@/lib/email.functions";
import { sendInAppNotification } from "@/lib/notifications.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StudentStatusBadge } from "@/components/edufinance/Badges";
import { cn } from "@/lib/utils";
import { AnnouncementsTab } from "@/components/crm/AnnouncementsTab";


type StatusKey = "active" | "inactive" | "churned";
const STATUS_CHIPS: { key: StatusKey; label: string }[] = [
  { key: "active", label: "Ativos" },
  { key: "inactive", label: "Inativos" },
  { key: "churned", label: "Churn" },
];

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
  kind: "studio" | "pt";
};

function CRMPage() {
  const { data: studioStudents = [] } = useQuery({
    queryKey: ["crm-students"],
    queryFn: async () => {
      const { data } = await supabase
        .from("students")
        .select("id,name,email,phone,status")
        .order("name");
      return ((data ?? []) as any[]).map((s) => ({ ...s, kind: "studio" as const }));
    },
  });

  const { data: ptStudents = [] } = useQuery({
    queryKey: ["crm-pt-students"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pt_students")
        .select("id,name,email,phone,status")
        .is("deleted_at", null)
        .order("name");
      return ((data ?? []) as any[]).map((s) => ({ ...s, kind: "pt" as const }));
    },
  });

  const students: Student[] = [...studioStudents, ...ptStudents];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={PageIcon}
        eyebrow="Relacionamento"
        title="CRM"
        description="Comunique-se com seus alunos por email ou WhatsApp"
      />

      <Tabs defaultValue="individual" className="space-y-4">
        <TabsList>
          <TabsTrigger value="individual">Mensagem Individual</TabsTrigger>
          <TabsTrigger value="bulk">Disparo em Massa</TabsTrigger>
          <TabsTrigger value="announcements">Avisos Internos</TabsTrigger>
        </TabsList>

        <TabsContent value="individual">
          <IndividualMessage students={students} />
        </TabsContent>

        <TabsContent value="bulk">
          <BulkMessage students={students} />
        </TabsContent>

        <TabsContent value="announcements">
          <AnnouncementsTab />
        </TabsContent>
      </Tabs>

    </div>
  );
}


function IndividualMessage({ students }: { students: Student[] }) {
  const [source, setSource] = useState<"all" | "studio" | "pt">("all");
  const [studentId, setStudentId] = useState("");
  const [channel, setChannel] = useState<"email" | "whatsapp" | "inapp">("email");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const sendEmailFn = useServerFn(sendEmail);
  const sendInAppFn = useServerFn(sendInAppNotification);

  const filteredStudents = useMemo(
    () => students.filter((s) => source === "all" || s.kind === source),
    [students, source],
  );
  const student = students.find((s) => s.id === studentId);


  async function send() {
    if (!student) return toast.error("Selecione um aluno.");
    if (!message.trim()) return toast.error("Digite uma mensagem.");

    const personalizedMessage = message.replace(/\{nome\}/gi, student.name);

    if (channel === "email") {
      if (!student.email) return toast.error("Este aluno não tem email cadastrado.");
      setSending(true);
      try {
        await sendEmailFn({
          data: {
            to: student.email,
            subject: subject || "Mensagem da sua academia",
            text: personalizedMessage,
          },
        });
        toast.success(`Email enviado para ${student.name}!`);
        setMessage("");
        setSubject("");
      } catch (e: any) {
        toast.error(`Erro ao enviar email: ${e.message ?? "verifique suas configurações"}`);
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


    if (channel === "inapp") {
      setSending(true);
      try {
        const res = await sendInAppFn({
          data: {
            studentIds: [student.id],
            title: subject || "Nova mensagem do studio",
            body: personalizedMessage,
            kind: student.kind,
          },
        });
        if (res.sent > 0) {
          toast.success(`Notificação enviada para ${student.name}!`);
          setMessage("");
          setSubject("");
        } else {
          toast.error(`${student.name} ainda não tem acesso ao app.`);
        }
      } catch (e: any) {
        toast.error(`Erro: ${e.message ?? "tente novamente"}`);
      }
      setSending(false);
      return;
    }
  }


  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <Card className="p-5 space-y-4">
        <h2 className="text-sm font-semibold">Destinatário e canal</h2>

        <div className="space-y-1.5">
          <Label>Tipo de aluno</Label>
          <div className="flex gap-2">
            {(["all", "studio", "pt"] as const).map((s) => (
              <Button
                key={s}
                type="button"
                variant={source === s ? "default" : "outline"}
                size="sm"
                onClick={() => { setSource(s); setStudentId(""); }}
              >
                {s === "all" ? "Todos" : s === "studio" ? "Studio" : "Personal"}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Aluno</Label>
          <Select value={studentId} onValueChange={setStudentId}>
            <SelectTrigger><SelectValue placeholder="Selecione um aluno" /></SelectTrigger>
            <SelectContent>
              {filteredStudents.map((s) => (
                <SelectItem key={`${s.kind}-${s.id}`} value={s.id}>
                  {s.kind === "pt" ? "🏋️ " : "🎓 "}{s.name}{s.email ? ` · ${s.email}` : ""}{s.phone ? ` · ${s.phone}` : ""}
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
            {(["email", "whatsapp", "inapp"] as const).map((c) => (
              <Button
                key={c}
                type="button"
                variant={channel === c ? "default" : "outline"}
                size="sm"
                onClick={() => setChannel(c)}
                className="transition-colors duration-150"
              >
                {c === "email" ? "📧 Email" : c === "whatsapp" ? "💬 WhatsApp" : "🔔 No app"}
              </Button>
            ))}
          </div>
        </div>

        {(channel === "email" || channel === "inapp") && (
          <div className="space-y-1.5">
            <Label>{channel === "email" ? "Assunto" : "Título da notificação"}</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={channel === "email" ? "Ex: Lembrete de pagamento" : "Ex: Aula remarcada"} />
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


        <Button onClick={send} disabled={sending} className="w-full transition-all duration-200">
          <Send className="mr-2 h-4 w-4" />
          {sending ? "Enviando…" : channel === "email" ? "Enviar email" : channel === "whatsapp" ? "Abrir WhatsApp" : "Enviar notificação"}
        </Button>
      </Card>

      <TemplatesPanel onSelect={setMessage} />
    </div>
  );
}

function BulkMessage({ students }: { students: Student[] }) {
  const [source, setSource] = useState<"all" | "studio" | "pt">("all");
  const [statusFilter, setStatusFilter] = useState<Set<StatusKey>>(
    () => new Set<StatusKey>(["active", "inactive", "churned"]),
  );
  const [channel, setChannel] = useState<"email" | "whatsapp" | "inapp">("email");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<{ name: string; ok: boolean; reason?: string }[]>([]);
  const sendEmailFn = useServerFn(sendEmail);
  const sendInAppFn = useServerFn(sendInAppNotification);

  const filtered = useMemo(
    () => students.filter(
      (s) => (source === "all" || s.kind === source) && statusFilter.has(s.status as StatusKey),
    ),
    [students, statusFilter, source],
  );


  const counts = useMemo(() => {
    const c: Record<StatusKey, number> = { active: 0, inactive: 0, churned: 0 };
    for (const s of students) {
      if (s.status in c) c[s.status as StatusKey]++;
    }
    return c;
  }, [students]);

  function toggleStatus(key: StatusKey) {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size === 1) return prev; // manter ao menos um
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
    setSelected(new Set());
  }

  const allSelected = filtered.length > 0 && filtered.every((s) => selected.has(s.id));

  async function sendBulk() {
    if (selected.size === 0) return toast.error("Selecione pelo menos um aluno.");
    if (!message.trim()) return toast.error("Digite uma mensagem.");
    setSending(true);
    setResults([]);

    const targets = students.filter((s) => selected.has(s.id));
    const res: typeof results = [];

    // In-app: envio em lote por tipo de aluno (studio vs pt)
    if (channel === "inapp") {
      const studioTargets = targets.filter((t) => t.kind === "studio");
      const ptTargets = targets.filter((t) => t.kind === "pt");
      try {
        for (const [kind, group] of [["studio", studioTargets], ["pt", ptTargets]] as const) {
          if (group.length === 0) continue;
          const r = await sendInAppFn({
            data: {
              studentIds: group.map((t) => t.id),
              title: subject || "Nova mensagem do studio",
              body: message,
              kind,
            },
          });
          const skipped = new Set(r.skipped);
          for (const t of group) {
            if (skipped.has(t.name)) res.push({ name: t.name, ok: false, reason: "sem acesso ao app" });
            else res.push({ name: t.name, ok: true });
          }
        }
      } catch (e: any) {
        toast.error(`Erro: ${e.message ?? "tente novamente"}`);
        setSending(false);
        return;
      }
      setResults(res);
      setSending(false);
      toast.success(`${res.filter((r) => r.ok).length} notificação(ões) enviada(s).`);
      return;
    }


    for (const s of targets) {
      if (channel === "email") {
        if (!s.email) { res.push({ name: s.name, ok: false, reason: "sem email" }); continue; }
        try {
          await sendEmailFn({
            data: {
              to: s.email,
              subject: subject || "Mensagem da sua academia",
              text: message.replace(/\{nome\}/gi, s.name),
            },
          });
          res.push({ name: s.name, ok: true });
        } catch (e: any) {
          res.push({ name: s.name, ok: false, reason: e.message ?? "erro" });
        }
        await new Promise((r) => setTimeout(r, 200));
      } else {
        if (!s.phone) { res.push({ name: s.name, ok: false, reason: "sem telefone" }); continue; }
        const phone = s.phone.replace(/\D/g, "");
        window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(message.replace(/\{nome\}/gi, s.name))}`, "_blank");
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

        <div className="space-y-1.5">
          <Label>Tipo de aluno</Label>
          <div className="flex gap-2">
            {(["all", "studio", "pt"] as const).map((s) => (
              <Button
                key={s}
                type="button"
                variant={source === s ? "default" : "outline"}
                size="sm"
                onClick={() => { setSource(s); setSelected(new Set()); }}
              >
                {s === "all" ? "Todos" : s === "studio" ? "Studio" : "Personal"}
              </Button>
            ))}
          </div>
        </div>


        <div className="space-y-1.5">
          <Label>Filtrar alunos por status</Label>
          <div className="flex flex-wrap gap-2">
            {STATUS_CHIPS.map((s) => {
              const active = statusFilter.has(s.key);
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => toggleStatus(s.key)}
                  aria-pressed={active}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-200",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    active
                      ? "border-primary bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                      : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:bg-accent hover:text-foreground",
                  )}
                >
                  <span>{s.label}</span>
                  <span
                    className={cn(
                      "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none tabular-nums",
                      active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {counts[s.key]}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Combine status para direcionar a mensagem. Ex.: só <strong>inativos + churn</strong> para reengajar.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>Canal</Label>
          <div className="flex flex-wrap gap-2">
            {(["email", "whatsapp", "inapp"] as const).map((c) => (
              <Button
                key={c}
                type="button"
                variant={channel === c ? "default" : "outline"}
                size="sm"
                onClick={() => setChannel(c)}
                className="transition-colors duration-150"
              >
                {c === "email" ? "📧 Email" : c === "whatsapp" ? "💬 WhatsApp" : "🔔 No app"}
              </Button>
            ))}
          </div>
        </div>

        {(channel === "email" || channel === "inapp") && (
          <div className="space-y-1.5">
            <Label>{channel === "email" ? "Assunto" : "Título da notificação"}</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={channel === "email" ? "Assunto do email" : "Ex: Novidade da semana"}
            />
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

        <Button
          onClick={sendBulk}
          disabled={sending || selected.size === 0}
          className="w-full transition-all duration-200"
        >
          {channel === "inapp" ? <Bell className="mr-2 h-4 w-4" /> : <Send className="mr-2 h-4 w-4" />}
          {sending
            ? "Enviando…"
            : channel === "inapp"
              ? `Notificar ${selected.size} aluno(s) no app`
              : `Enviar para ${selected.size} aluno(s)`}
        </Button>

        {channel === "whatsapp" ? (
          <p className="text-xs text-muted-foreground">
            💡 Para WhatsApp em massa, o app abrirá uma janela por aluno. Recomendamos selecionar até 5 por vez.
          </p>
        ) : channel === "inapp" ? (
          <p className="text-xs text-muted-foreground">
            🔔 Chegará como notificação e pop-up dentro do app do aluno. Alunos sem acesso são ignorados automaticamente.
          </p>
        ) : null}
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
                key={`${s.kind}-${s.id}`}
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
                <TableCell className="font-medium">
                  <span className="mr-1.5">{s.kind === "pt" ? "🏋️" : "🎓"}</span>{s.name}
                </TableCell>
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
                    <span className={r.ok ? "text-state-paid font-medium" : "text-destructive font-medium"}>
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

const TEMPLATES_STUDIO = [
  { label: "💰 Lembrete de pagamento", text: "Olá {nome}! Passando para lembrar que sua mensalidade está próxima do vencimento. Qualquer dúvida, estou à disposição!" },
  { label: "😊 Boas-vindas", text: "Olá {nome}, seja muito bem-vindo(a)! Estamos felizes em ter você conosco. Qualquer dúvida, é só chamar." },
  { label: "🎊 Boas-vindas — novo aluno (completa)", text: "Olá {nome}, seja muito bem-vindo(a) à nossa família! 🎉\n\nEstamos animados por você começar essa jornada com a gente. Algumas informações importantes:\n\n• Sua próxima aula: [informe dia e horário]\n• Traga: roupa confortável, tênis, toalha e garrafa d'água\n• Chegue 10 minutos antes para se ambientar\n\nQualquer dúvida antes da aula, é só me chamar por aqui. Bons treinos! 💪" },
  { label: "👋 Boas-vindas — primeira aula amanhã", text: "Oi {nome}! Tudo pronto para sua primeira aula amanhã? 😊\n\nTe espero em [dia e horário]. Lembre-se de trazer roupa confortável, toalha e água. Se precisar de qualquer orientação antes, é só me chamar!" },
  { label: "📅 Confirmar aula", text: "Oi {nome}! Confirma presença na aula de amanhã? Te espero!" },
  { label: "🔄 Aluno inativo", text: "Olá {nome}, sentimos sua falta! Que tal retomar os treinos? Entre em contato e vamos combinar." },
  { label: "🎉 Parabéns", text: "Feliz aniversário, {nome}! 🎂 Desejamos um dia incrível e muito sucesso na sua jornada!" },
  { label: "📢 Aviso geral", text: "Olá {nome}! Temos um aviso importante para você. Por favor, entre em contato o quanto antes." },
];

const TEMPLATES_PT = [
  { label: "🏋️ Boas-vindas PT", text: "Olá {nome}! Seja muito bem-vindo(a) ao acompanhamento personalizado. Já preparei seu primeiro treino — qualquer dúvida sobre execução ou horários, me chame por aqui." },
  { label: "🎯 Boas-vindas PT — completa com 1ª sessão", text: "Olá {nome}, seja muito bem-vindo(a) ao acompanhamento PT! 💪\n\nEstou muito animado(a) por acompanhar sua evolução. Aqui vai o que você precisa saber:\n\n• Sua primeira sessão: [dia e horário]\n• Local: [endereço/estúdio]\n• Traga: roupa de treino, tênis, toalha e água\n• Seu treino inicial já está liberado no app — dá uma olhada antes\n\nQualquer dúvida, é só me chamar por aqui. Vamos começar com tudo! 🔥" },
  { label: "📆 Boas-vindas PT — próxima aula", text: "Oi {nome}! Que bom te ter no acompanhamento PT. 🙌\n\nSua próxima sessão está marcada para [dia e horário]. Vou te esperar preparado(a) com o treino personalizado. Se precisar reagendar ou tiver qualquer dúvida, me avise por aqui!" },
  { label: "📅 Confirmar sessão PT", text: "Oi {nome}! Confirma nossa sessão de PT? Lembre-se de trazer água, toalha e roupa confortável. Nos vemos em breve!" },
  { label: "⏰ Reagendamento", text: "Olá {nome}, precisamos reagendar nossa próxima sessão. Me envie 2 ou 3 horários que funcionem para você que eu confirmo o encaixe." },
  { label: "💪 Novo treino disponível", text: "Oi {nome}! Seu novo treino já está liberado no app. Dá uma olhada nos exercícios, cargas e vídeos antes da próxima sessão — qualquer dúvida, me chame!" },
  { label: "📊 Avaliação/Reavaliação", text: "Olá {nome}! Está na hora da sua reavaliação física. Vamos medir sua evolução e ajustar o treino para os próximos ciclos. Me passe um horário que funciona pra você." },
  { label: "🔥 Pacote acabando", text: "Oi {nome}! Suas sessões de PT estão acabando. Quer renovar o pacote para não perder o ritmo do treino? Posso já deixar tudo pronto." },
  { label: "😴 Aluno PT inativo", text: "Olá {nome}, senti sua falta nas últimas sessões! Que tal marcarmos uma volta gradual? Podemos ajustar a intensidade para retomar sem desconforto." },
  { label: "🏆 Meta atingida", text: "{nome}, parabéns pela evolução! 🎯 Seu esforço nas últimas semanas tem sido incrível. Vamos ajustar as próximas metas para continuar progredindo." },
  { label: "💧 Lembrete de hidratação/descanso", text: "Oi {nome}! Só um lembrete: hidratação e sono de qualidade são parte do treino. Cuide desses dois pontos até nossa próxima sessão. 💪" },
  { label: "💳 Cobrança PT", text: "Olá {nome}! Sua mensalidade do acompanhamento PT está próxima do vencimento. Qualquer coisa sobre pagamento, é só me chamar." },
  { label: "📸 Pedido de feedback", text: "Oi {nome}! Como você está se sentindo com o treino atual? Algum exercício incomodando ou algo que gostaria de mudar? Seu retorno me ajuda a evoluir sua ficha." },
];

function TemplatesPanel({ onSelect }: { onSelect: (text: string) => void }) {
  const [tab, setTab] = useState<"studio" | "pt">("studio");
  const list = tab === "studio" ? TEMPLATES_STUDIO : TEMPLATES_PT;
  return (
    <Card className="p-5 space-y-3">
      <h2 className="text-sm font-semibold">Modelos de mensagem</h2>
      <Tabs value={tab} onValueChange={(v) => setTab(v as "studio" | "pt")}>
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="studio">Studio</TabsTrigger>
          <TabsTrigger value="pt">Personal Trainer</TabsTrigger>
        </TabsList>
      </Tabs>
      <p className="text-xs text-muted-foreground">Clique para usar um modelo como base.</p>
      <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
        {list.map((t) => (
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

