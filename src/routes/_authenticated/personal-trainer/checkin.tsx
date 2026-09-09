import { PageHeader } from "@/components/ui-kit/PageHeader";
import { createFileRoute } from "@tanstack/react-router";
import { confirmDialog } from "@/lib/confirm-dialog";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, Search, Zap, ChevronDown, Pencil, RotateCcw, Users, User, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PTStudentStatusBadge } from "@/components/pt/PTBadges";
import { initials } from "@/lib/format";
import { addSessionToCalendar } from "@/lib/gcal";
import { cn } from "@/lib/utils";
import { useScopeFilter } from "@/hooks/use-scope-filter";
import { parseStudentPartner } from "@/lib/pt-duo";


export const Route = createFileRoute("/_authenticated/personal-trainer/checkin")({
  head: () => ({ meta: [{ title: "Check-in Rápido PT — EduFinance" }] }),
  component: CheckinPage,
});

type CheckinResult = {
  studentId: string;
  studentName: string;
  sessionId: string;
  time: string;
  duration: number;
  status: string;
};

const WA_TEMPLATE_KEY = "edufinance.checkinWhatsAppTemplate";

const DEFAULT_WA_TEMPLATE = `Olá {{aluno}}! ✅

Seu check-in foi registrado com sucesso!

📅 *Data:* {{data}}
🕐 *Horário:* {{hora}}
⏱️ *Duração:* {{duracao}}

📦 *Saldo restante:* {{saldo}} aula(s)
   • {{utilizadas}} de {{contratadas}} aulas utilizadas

Bom treino! 💪`;

const WA_VARS = [
  { key: "aluno", label: "Nome do aluno" },
  { key: "data", label: "Data do check-in" },
  { key: "hora", label: "Horário" },
  { key: "duracao", label: "Duração" },
  { key: "saldo", label: "Aulas restantes" },
  { key: "utilizadas", label: "Aulas utilizadas" },
  { key: "contratadas", label: "Aulas contratadas" },
  { key: "plano", label: "Nome do pacote" },
];

function applyTemplate(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k: string) => vars[k] ?? "");
}


function CheckinPage() {
  const qc = useQueryClient();
  const { scopeId, scopeKey, ready } = useScopeFilter();
  const today = format(new Date(), "yyyy-MM-dd");
  const todayLabel = format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR });


  const [search, setSearch] = useState("");
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [duration, setDuration] = useState("60");
  const [sessionTime, setSessionTime] = useState(format(new Date(), "HH:mm"));
  const [checkedIn, setCheckedIn] = useState<CheckinResult[]>([]);
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const [sendWhatsApp, setSendWhatsApp] = useState(
    typeof window !== "undefined"
      ? localStorage.getItem("edufinance.checkinWhatsApp") === "true"
      : false
  );
  const [waTemplate, setWaTemplate] = useState("");
  const [tplOpen, setTplOpen] = useState(false);
  const [tplDraft, setTplDraft] = useState("");

  useEffect(() => {
    try {
      setWaTemplate(localStorage.getItem(WA_TEMPLATE_KEY) ?? "");
    } catch { /* ignore */ }
  }, []);

  function openTemplateEditor() {
    setTplDraft(waTemplate.trim() ? waTemplate : DEFAULT_WA_TEMPLATE);
    setTplOpen(true);
  }

  function saveTemplate() {
    const value = tplDraft.trim();
    setWaTemplate(value);
    try {
      if (value) localStorage.setItem(WA_TEMPLATE_KEY, value);
      else localStorage.removeItem(WA_TEMPLATE_KEY);
    } catch { /* ignore */ }
    setTplOpen(false);
    toast.success("Mensagem de WhatsApp atualizada.");
  }




  const { data: students = [] } = useQuery({
    queryKey: ["pt-students-checkin", scopeKey],
    enabled: ready,
    queryFn: async () => {
      let q = supabase
        .from("pt_students")
        .select("id,name,phone,status,goal,health_notes,notes,pt_payments(id,amount,payment_date,status,sessions_paid,reference_month,pt_plans(name,sessions_per_month))")
        .eq("status", "active")
        .is("deleted_at", null)
        .order("name");
      if (scopeId) q = q.eq("user_id", scopeId);
      return (await q).data ?? [];
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const { data: usedCounts = [] } = useQuery({
    queryKey: ["pt-sessions-used-counts", scopeKey],
    enabled: ready,
    queryFn: async () => {
      let q = supabase
        .from("pt_sessions")
        .select("pt_payment_id")
        .not("pt_payment_id", "is", null);
      if (scopeId) q = q.eq("user_id", scopeId);
      return (await q).data ?? [];
    },
  });


  const { data: todaySessions = [], refetch: refetchSessions } = useQuery({
    queryKey: ["pt-today-sessions", today, scopeKey],
    enabled: ready,
    queryFn: async () => {
      let q = supabase
        .from("pt_sessions")
        .select("id,pt_student_id,session_time,duration_minutes,status,pt_students(name)")
        .eq("session_date", today)
        .order("session_time");
      if (scopeId) q = q.eq("user_id", scopeId);
      return (await q).data ?? [];
    },
  });


  const filtered = useMemo(() => {
    const q = search.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
    return students.filter((s: any) => {
      const name = s.name.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
      return !q || name.includes(q);
    });
  }, [students, search]);

  const alreadyCheckedInIds = useMemo(
    () => new Set(todaySessions.map((s: any) => s.pt_student_id)),
    [todaySessions]
  );

  type PaymentBalance = {
    id: string;
    payment_date: string;
    reference_month: string | null;
    planName: string | null;
    contracted: number;
    used: number;
    remaining: number;
  };
  type StudentBalance = {
    contracted: number;
    used: number;
    remaining: number;
    payments: PaymentBalance[]; // oldest → newest
    packagesWithBalance: PaymentBalance[]; // remaining > 0, oldest → newest
    isShared?: boolean;
    sharedPartnerName?: string;
    sharedPartnerId?: string;
  };

  const [duoModal, setDuoModal] = useState<{
    student: any;
    partner: any;
    partnerCheckedIn: boolean;
    partnerSession?: any;
  } | null>(null);
  const [soloDebitMode, setSoloDebitMode] = useState<"package" | "free">("package");

  const studentById = useMemo(() => new Map<string, any>(students.map((s: any) => [s.id, s])), [students]);

  const balanceMap = useMemo(() => {
    const usedByPayment = new Map<string, number>();
    for (const row of usedCounts as any[]) {
      const pid = row.pt_payment_id;
      if (!pid) continue;
      usedByPayment.set(pid, (usedByPayment.get(pid) ?? 0) + 1);
    }
    const map = new Map<string, StudentBalance>();
    for (const s of students as any[]) {
      const payments: PaymentBalance[] = [];
      for (const p of s.pt_payments ?? []) {
        if (p.status !== "paid") continue;
        const contracted = Number(p.pt_plans?.sessions_per_month ?? p.sessions_paid ?? 0) || 0;
        const used = usedByPayment.get(p.id) ?? 0;
        payments.push({
          id: p.id,
          payment_date: p.payment_date,
          reference_month: p.reference_month ?? null,
          planName: p.pt_plans?.name ?? null,
          contracted,
          used,
          remaining: Math.max(0, contracted - used),
        });
      }
      payments.sort((a, b) => (a.payment_date < b.payment_date ? -1 : a.payment_date > b.payment_date ? 1 : 0));
      const contracted = payments.reduce((acc, p) => acc + p.contracted, 0);
      const used = payments.reduce((acc, p) => acc + p.used, 0);
      map.set(s.id, {
        contracted,
        used,
        remaining: Math.max(0, contracted - used),
        payments,
        packagesWithBalance: payments.filter((p) => p.remaining > 0 && p.contracted > 0),
      });
    }
    return map;
  }, [students, usedCounts]);

  const getEffectiveBalance = (studentId: string): StudentBalance => {
    const s = studentById.get(studentId);
    const selfBal = balanceMap.get(studentId);
    if (selfBal && selfBal.contracted > 0) return selfBal;

    const partnerId = s ? parseStudentPartner(s.notes).partnerId : null;
    if (partnerId) {
      const pBal = balanceMap.get(partnerId);
      const partner = studentById.get(partnerId);
      if (pBal && pBal.contracted > 0) {
        return {
          ...pBal,
          isShared: true,
          sharedPartnerName: partner?.name ?? "Parceiro(a)",
          sharedPartnerId: partnerId,
        };
      }
    }
    return selfBal ?? { contracted: 0, used: 0, remaining: 0, payments: [], packagesWithBalance: [] };
  };

  function sendWaNotification(
    targetStudent: any,
    bal: StudentBalance,
    chosen: PaymentBalance | null,
  ) {
    if (!targetStudent.phone) return;
    const dateLabel = new Date().toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    });
    const timeLabel = sessionTime;

    const lines: string[] = [
      `Olá ${targetStudent.name}! ✅`,
      ``,
      `Seu check-in foi registrado com sucesso!`,
      ``,
      `📅 *Data:* ${dateLabel}`,
      `🕐 *Horário:* ${timeLabel}`,
    ];

    if (chosen && bal) {
      const totalRemainingAfter = Math.max(0, bal.remaining - 1);
      const usedAfter = chosen.used + 1;
      const otherRemaining = bal.packagesWithBalance
        .filter((p) => p.id !== chosen.id)
        .reduce((acc, p) => acc + p.remaining, 0);
      const otherCount = bal.packagesWithBalance.filter((p) => p.id !== chosen.id && p.remaining > 0).length;
      const openPackages = bal.packagesWithBalance.length;

      lines.push(``);
      if (openPackages > 1) {
        lines.push(`📦 *Saldo restante:* ${totalRemainingAfter} aula(s) em ${openPackages} pacote(s)`);
      } else {
        lines.push(`📦 *Saldo restante:* ${totalRemainingAfter} aula(s)`);
      }
      lines.push(`   • ${usedAfter} de ${chosen.contracted} aulas utilizadas`);
      if (otherCount > 0) {
        lines.push(`   • Outros pacotes em aberto: ${otherCount} pacote(s), ${otherRemaining} aula(s)`);
      }
      if (totalRemainingAfter === 0) {
        lines.push(``);
        lines.push(`⚠️ *Atenção:* Esta foi sua última aula em aberto. Renove para continuar treinando!`);
      }
    } else {
      lines.push(``);
      lines.push(`ℹ️ Check-in registrado com sucesso.`);
    }

    lines.push(``);
    lines.push(`Bom treino! 💪`);

    const defaultMessage = lines.join("\n");
    const totalRemainingAfter = chosen && bal ? Math.max(0, bal.remaining - 1) : 0;
    const whatsappMessage = waTemplate.trim()
      ? applyTemplate(waTemplate, {
          aluno: targetStudent.name,
          data: dateLabel,
          hora: timeLabel,
          duracao: `${duration} min`,
          saldo: String(totalRemainingAfter),
          utilizadas: chosen ? String(chosen.used + 1) : "0",
          contratadas: chosen ? String(chosen.contracted) : "0",
          plano: chosen?.planName ?? "",
        })
      : defaultMessage;
    const phone = targetStudent.phone.replace(/\D/g, "");
    const url = `https://wa.me/55${phone}?text=${encodeURIComponent(whatsappMessage)}`;
    window.open(url, "_blank");
  }

  async function promptGoogleCalendar(studentName: string) {
    const gcalClientId = localStorage.getItem("edufinance.gcalClientId");
    if (gcalClientId) {
      const addToCalendar = await confirmDialog(
        `Adicionar aula de ${studentName} ao Google Calendar?`,
      );
      if (addToCalendar) {
        addSessionToCalendar({
          studentName,
          sessionDate: today,
          sessionTime,
          durationMinutes: Number(duration),
        });
      }
    }
  }

  function handleCheckinClick(student: any) {
    const { partnerId } = parseStudentPartner(student.notes);
    const partner = partnerId ? studentById.get(partnerId) : null;
    if (!partner) {
      return executeSingleCheckin(student, true);
    }
    const partnerCheckedIn = alreadyCheckedInIds.has(partner.id);
    const partnerSession = todaySessions.find((ts: any) => ts.pt_student_id === partner.id);
    setSoloDebitMode("package");
    setDuoModal({
      student,
      partner,
      partnerCheckedIn,
      partnerSession,
    });
  }

  async function executeSingleCheckin(student: any, debitPackage: boolean) {
    setCheckingIn(student.id);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Usuário não autenticado");

      const effBal = getEffectiveBalance(student.id);
      let chosenPaymentId: string | null = null;
      let chosenPkg: PaymentBalance | null = null;

      if (debitPackage) {
        const chosen = effBal.packagesWithBalance[0] ?? null;
        const latestPaid = [...(student.pt_payments ?? [])]
          .filter((p: any) => p.status === "paid")
          .sort((a: any, b: any) => (a.payment_date < b.payment_date ? 1 : -1))[0];
        chosenPaymentId = chosen?.id ?? latestPaid?.id ?? null;
        chosenPkg = chosen;
      }

      const { data, error } = await supabase
        .from("pt_sessions")
        .insert({
          user_id: userId,
          pt_student_id: student.id,
          pt_payment_id: chosenPaymentId,
          session_date: today,
          session_time: sessionTime + ":00",
          duration_minutes: Number(duration),
          status: "completed",
        })
        .select("id")
        .single();

      if (error) throw error;

      const result: CheckinResult = {
        studentId: student.id,
        studentName: student.name,
        sessionId: data.id,
        time: sessionTime,
        duration: Number(duration),
        status: "completed",
      };

      setCheckedIn((prev) => [result, ...prev]);
      const multiPackages = (effBal.packagesWithBalance.length ?? 0) > 1;
      toast.success(
        chosenPaymentId
          ? multiPackages && chosenPkg?.planName
            ? `✅ Check-in de ${student.name} — consumido do pacote ${chosenPkg.planName}`
            : `✅ Check-in de ${student.name} registrado!`
          : `✅ Check-in avulso de ${student.name} registrado (sem débito de pacote)!`,
      );
      qc.invalidateQueries();
      refetchSessions();

      if (sendWhatsApp && student.phone) {
        sendWaNotification(student, effBal, chosenPkg);
      } else if (sendWhatsApp && !student.phone) {
        toast.warning(`${student.name} não tem telefone cadastrado — WhatsApp não enviado.`);
      }

      promptGoogleCalendar(student.name);
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setCheckingIn(null);
      setDuoModal(null);
    }
  }

  async function executeDuoJointCheckin(student: any, partner: any) {
    setCheckingIn(student.id);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Usuário não autenticado");

      const sBal = balanceMap.get(student.id);
      const pBal = balanceMap.get(partner.id);

      let payingStudent = student;
      let companionStudent = partner;
      let chosenPkg = sBal?.packagesWithBalance[0] ?? null;

      if (!chosenPkg && pBal?.packagesWithBalance[0]) {
        payingStudent = partner;
        companionStudent = student;
        chosenPkg = pBal.packagesWithBalance[0];
      }

      const chosenPaymentId = chosenPkg?.id ?? null;

      // Sessão 1: Aluno com pacote (debita 1 aula da cota)
      const { data: s1, error: e1 } = await supabase
        .from("pt_sessions")
        .insert({
          user_id: userId,
          pt_student_id: payingStudent.id,
          pt_payment_id: chosenPaymentId,
          session_date: today,
          session_time: sessionTime + ":00",
          duration_minutes: Number(duration),
          performance_notes: `Treino em Dupla com ${companionStudent.name}`,
          status: "completed",
        })
        .select("id")
        .single();
      if (e1) throw e1;

      // Sessão 2: Parceiro de treino (pt_payment_id: null, sem debitar cota adicional)
      const { data: s2, error: e2 } = await supabase
        .from("pt_sessions")
        .insert({
          user_id: userId,
          pt_student_id: companionStudent.id,
          pt_payment_id: null,
          session_date: today,
          session_time: sessionTime + ":00",
          duration_minutes: Number(duration),
          performance_notes: `Treino em Dupla com ${payingStudent.name} (Sessão compartilhada)`,
          status: "completed",
        })
        .select("id")
        .single();
      if (e2) throw e2;

      setCheckedIn((prev) => [
        {
          studentId: payingStudent.id,
          studentName: payingStudent.name,
          sessionId: s1.id,
          time: sessionTime,
          duration: Number(duration),
          status: "completed",
        },
        {
          studentId: companionStudent.id,
          studentName: companionStudent.name,
          sessionId: s2.id,
          time: sessionTime,
          duration: Number(duration),
          status: "completed",
        },
        ...prev,
      ]);

      toast.success(
        `✅ Check-in de Dupla registrado! (${student.name} & ${partner.name}) — apenas 1 aula debitada do plano.`,
      );
      qc.invalidateQueries();
      refetchSessions();

      if (sendWhatsApp) {
        if (student.phone) {
          sendWaNotification(student, getEffectiveBalance(student.id), chosenPkg);
        }
        if (partner.phone) {
          toast.info(`Deseja enviar WhatsApp para ${partner.name}?`, {
            action: {
              label: "Enviar WhatsApp",
              onClick: () => sendWaNotification(partner, getEffectiveBalance(partner.id), chosenPkg),
            },
            duration: 8000,
          });
        }
      }

      promptGoogleCalendar(`${student.name} e ${partner.name}`);
    } catch (err: any) {
      toast.error(`Erro no check-in em dupla: ${err.message}`);
    } finally {
      setCheckingIn(null);
      setDuoModal(null);
    }
  }

  async function executeLinkToExistingDuo(student: any, partner: any) {
    setCheckingIn(student.id);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("pt_sessions")
        .insert({
          user_id: userId,
          pt_student_id: student.id,
          pt_payment_id: null,
          session_date: today,
          session_time: sessionTime + ":00",
          duration_minutes: Number(duration),
          performance_notes: `Treino em Dupla com ${partner.name} (Sessão vinculada)`,
          status: "completed",
        })
        .select("id")
        .single();
      if (error) throw error;

      setCheckedIn((prev) => [
        {
          studentId: student.id,
          studentName: student.name,
          sessionId: data.id,
          time: sessionTime,
          duration: Number(duration),
          status: "completed",
        },
        ...prev,
      ]);

      toast.success(
        `✅ Presença de ${student.name} vinculada ao treino da dupla (sem débito adicional)!`,
      );
      qc.invalidateQueries();
      refetchSessions();

      if (sendWhatsApp && student.phone) {
        sendWaNotification(student, getEffectiveBalance(student.id), null);
      }
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    } finally {
      setCheckingIn(null);
      setDuoModal(null);
    }
  }

  async function undoCheckin(sessionId: string, studentName: string) {
    if (!(await confirmDialog(`Desfazer check-in de ${studentName}?`))) return;
    const { error } = await supabase.from("pt_sessions").delete().eq("id", sessionId);
    if (error) return toast.error(error.message);
    setCheckedIn((prev) => prev.filter((c) => c.sessionId !== sessionId));
    toast.success("Check-in desfeito.");
    qc.invalidateQueries();
    refetchSessions();
  }

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Zap}
        eyebrow="Presença"
        title="Check-in Rápido"
        description={<span className="capitalize">{todayLabel}</span>}
      />

      <Card className="p-4 space-y-3">
        <div className="text-sm font-semibold">Configurar aula</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Horário</Label>
            <Input
              type="time"
              value={sessionTime}
              onChange={(e) => setSessionTime(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Duração</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="45">45 min</SelectItem>
                <SelectItem value="60">60 min</SelectItem>
                <SelectItem value="90">90 min</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3 col-span-2 sm:col-span-1">
            <div>
              <div className="text-sm font-medium">💬 Notificar via WhatsApp</div>
              <div className="text-xs text-muted-foreground">
                Envia mensagem automática ao aluno no check-in
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={sendWhatsApp}
              aria-label="Alternar notificação via WhatsApp"
              onClick={() => {
                const next = !sendWhatsApp;
                setSendWhatsApp(next);
                localStorage.setItem("edufinance.checkinWhatsApp", String(next));
              }}
              className="relative inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  sendWhatsApp ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-background shadow-card transition-transform duration-200 ease-ui ${
                    sendWhatsApp ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </span>
            </button>
          </div>
          <div className="col-span-2 sm:col-span-1 flex items-center justify-between rounded-lg border p-3">
            <div className="min-w-0">
              <div className="text-sm font-medium">✏️ Texto da mensagem</div>
              <div className="truncate text-xs text-muted-foreground">
                {waTemplate.trim() ? "Modelo personalizado ativo" : "Usando o modelo padrão"}
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={openTemplateEditor}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Editar
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Todos os check-ins desta sessão usarão esses valores. Você pode ajustar individualmente depois na página do aluno.
        </p>
      </Card>

      <Dialog open={tplOpen} onOpenChange={setTplOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar mensagem do WhatsApp</DialogTitle>
            <DialogDescription>
              Personalize o texto enviado ao aluno no check-in. Use as variáveis abaixo — elas são
              substituídas automaticamente.
            </DialogDescription>
          </DialogHeader>

          <Textarea
            value={tplDraft}
            onChange={(e) => setTplDraft(e.target.value)}
            rows={12}
            className="font-mono text-xs"
          />

          <div className="flex flex-wrap gap-1.5">
            {WA_VARS.map((v) => (
              <button
                key={v.key}
                type="button"
                title={v.label}
                onClick={() => setTplDraft((t) => `${t}{{${v.key}}}`)}
                className="rounded-md border bg-muted/50 px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {`{{${v.key}}}`}
              </button>
            ))}
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="ghost" size="sm" onClick={() => setTplDraft(DEFAULT_WA_TEMPLATE)}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Restaurar padrão
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setTplOpen(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={saveTemplate}>Salvar mensagem</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!duoModal} onOpenChange={(open) => !open && setDuoModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Treino em Dupla
            </DialogTitle>
            <DialogDescription>
              {duoModal && (
                <span>
                  <strong>{duoModal.student.name}</strong> treina em dupla com{" "}
                  <strong>{duoModal.partner.name}</strong>. Como foi a presença de hoje?
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {duoModal && (
            <div className="space-y-4 py-1">
              {!duoModal.partnerCheckedIn ? (
                <>
                  <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-sm flex items-center gap-1.5 text-foreground">
                        <Users className="h-4 w-4 text-primary" />
                        Treinaram juntos hoje
                      </div>
                      <span className="text-[11px] bg-primary/15 text-primary px-2 py-0.5 rounded-full font-medium">
                        Recomendado
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Registra a presença e histórico para <strong>{duoModal.student.name}</strong> e{" "}
                      <strong>{duoModal.partner.name}</strong>, consumindo <strong>apenas 1 aula</strong> do pacote compartilhado.
                    </p>
                    <Button
                      className="w-full mt-1 font-medium gap-1.5"
                      disabled={checkingIn !== null}
                      onClick={() => executeDuoJointCheckin(duoModal.student, duoModal.partner)}
                    >
                      {checkingIn ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Users className="h-4 w-4" />
                          Confirmar Check-in da Dupla (1 aula)
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="rounded-lg border p-4 space-y-3 bg-card">
                    <div className="font-semibold text-sm flex items-center gap-1.5">
                      <User className="h-4 w-4 text-muted-foreground" />
                      Apenas {duoModal.student.name} treinou hoje (Individual)
                    </div>
                    <p className="text-xs text-muted-foreground">
                      O parceiro ({duoModal.partner.name}) não compareceu. Registra a presença apenas de {duoModal.student.name}.
                    </p>

                    <div className="space-y-2 pt-1 border-t border-border/50 text-xs">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="soloDebitMode"
                          checked={soloDebitMode === "package"}
                          onChange={() => setSoloDebitMode("package")}
                          className="text-primary"
                        />
                        <span>Debitar 1 aula do plano da dupla (padrão)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="soloDebitMode"
                          checked={soloDebitMode === "free"}
                          onChange={() => setSoloDebitMode("free")}
                          className="text-primary"
                        />
                        <span>Aula avulsa / reposição (sem debitar aula)</span>
                      </label>
                    </div>

                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={checkingIn !== null}
                      onClick={() => executeSingleCheckin(duoModal.student, soloDebitMode === "package")}
                    >
                      {checkingIn ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        `Registrar Apenas ${duoModal.student.name}`
                      )}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-lg border border-state-paid/30 bg-state-paid-soft p-3.5 text-xs space-y-1">
                    <div className="font-semibold text-state-paid flex items-center gap-1.5 text-sm">
                      <CheckCircle2 className="h-4 w-4" />
                      {duoModal.partner.name} já registrou check-in hoje!
                    </div>
                    <p className="text-muted-foreground">
                      {duoModal.partnerSession?.session_time && (
                        <span>Horário registrado: {duoModal.partnerSession.session_time.slice(0, 5)}. </span>
                      )}
                      Deseja vincular a presença de <strong>{duoModal.student.name}</strong> à mesma aula da dupla sem debitar outro crédito?
                    </p>
                  </div>

                  <Button
                    className="w-full gap-1.5"
                    disabled={checkingIn !== null}
                    onClick={() => executeLinkToExistingDuo(duoModal.student, duoModal.partner)}
                  >
                    {checkingIn ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Users className="h-4 w-4" />
                        Vincular à sessão da dupla (Sem débito extra)
                      </>
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={checkingIn !== null}
                    onClick={() => executeSingleCheckin(duoModal.student, true)}
                  >
                    Registrar aula individual separada (Debita 1 aula)
                  </Button>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDuoModal(null)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {todaySessions.length > 0 && (
        <Card className="border-state-paid/25 bg-state-paid-soft p-3">
          <div className="mb-2 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-state-paid" />
            <span className="text-sm font-semibold text-state-paid">
              {todaySessions.length} aula(s) registrada(s) hoje
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {todaySessions.map((s: any) => {
              const localResult = checkedIn.find((c) => c.sessionId === s.id);
              return (
                <div key={s.id} className="flex items-center gap-1 rounded-full bg-card px-2 py-0.5 text-xs shadow-card">
                  <CheckCircle2 className="h-3 w-3 text-state-paid" />
                  <span className="font-medium">{s.pt_students?.name}</span>
                  {s.session_time && (
                    <span className="text-muted-foreground">{s.session_time.slice(0, 5)}</span>
                  )}
                  {localResult && (
                    <button
                      onClick={() => undoCheckin(s.id, s.pt_students?.name)}
                      className="ml-1 text-destructive hover:underline"
                    >
                      desfazer
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          inputMode="search"
          placeholder="Buscar aluno por nome..."
          className="pl-9 h-11 text-base sm:text-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            Nenhum aluno ativo encontrado.
          </Card>
        )}
        {filtered.map((s: any) => {
          const isCheckedIn = alreadyCheckedInIds.has(s.id);
          const isLoading = checkingIn === s.id;
          const isExpanded = expandedStudent === s.id;
          const latestPayment = [...(s.pt_payments ?? [])]
            .filter((p: any) => p.status === "paid")
            .sort((a: any, b: any) => (a.payment_date < b.payment_date ? 1 : -1))[0];
          const planName = latestPayment?.pt_plans?.name;
          const sessionsPerMonth = latestPayment?.pt_plans?.sessions_per_month ?? latestPayment?.sessions_paid;
          const todayCount = todaySessions.filter((ts: any) => ts.pt_student_id === s.id).length;
          const bal = getEffectiveBalance(s.id);
          const nextPackage = bal?.packagesWithBalance[0] ?? null;
          const hasMultiplePackages = (bal?.packagesWithBalance.length ?? 0) > 1;

          const parsedPartner = parseStudentPartner(s.notes);
          const partner = parsedPartner.partnerId ? studentById.get(parsedPartner.partnerId) : null;
          const partnerCheckedIn = parsedPartner.partnerId ? alreadyCheckedInIds.has(parsedPartner.partnerId) : false;

          return (
            <Card key={s.id} className="p-3 transition-shadow duration-200 hover:shadow-md">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    isCheckedIn ? "bg-state-paid-soft text-state-paid" : "bg-primary/10 text-primary"
                  )}
                >
                  {isCheckedIn ? <CheckCircle2 className="h-5 w-5" /> : initials(s.name)}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{s.name}</span>
                    <PTStudentStatusBadge status={s.status} />
                    {partner && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-medium text-primary">
                        <Users className="h-3 w-3" />
                        Dupla: {partner.name}
                      </span>
                    )}
                    {partnerCheckedIn && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                        👥 Parceiro presente hoje
                      </span>
                    )}
                    {isCheckedIn && (
                      <span className="rounded-full bg-state-paid-soft px-2 py-0.5 text-[10px] font-medium text-state-paid">
                        ✅ {todayCount} aula(s) hoje
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {planName && <span>📋 {planName}</span>}
                    {sessionsPerMonth && <span>🏃 {sessionsPerMonth} aulas/mês</span>}
                    {bal && bal.contracted > 0 && (
                      <span aria-label="Saldo total de aulas">
                        💳 {bal.remaining}/{bal.contracted} restantes
                        {bal.isShared && (
                          <span className="ml-1 text-[11px] text-primary font-normal">
                            (plano de {bal.sharedPartnerName})
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                  {hasMultiplePackages && nextPackage && (
                    <div className="mt-1 text-[11px] leading-tight text-muted-foreground/90">
                      <span className="font-medium text-foreground/70">Próximo check-in usa:</span>{" "}
                      {nextPackage.planName ?? "pacote mais antigo"}
                      {nextPackage.reference_month ? ` · ${nextPackage.reference_month}` : ""}
                      {" · "}
                      {nextPackage.remaining} aula(s) em aberto
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 sm:gap-2">
                  <button
                    type="button"
                    aria-label={isExpanded ? `Ocultar detalhes de ${s.name}` : `Ver detalhes de pacotes de ${s.name}`}
                    onClick={() => setExpandedStudent(isExpanded ? null : s.id)}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ChevronDown className={cn("h-5 w-5 transition-transform duration-200", isExpanded && "rotate-180")} />
                  </button>
                  <Button
                    size="sm"
                    variant={isCheckedIn ? "outline" : "default"}
                    disabled={isLoading}
                    onClick={() => handleCheckinClick(s)}
                    className={cn(
                      "min-h-[44px] min-w-[105px] px-3 font-medium transition-all active:scale-[0.98]",
                      isCheckedIn && "border-state-paid/30 text-state-paid hover:bg-state-paid-soft"
                    )}
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 animate-spin" /> Registrando…
                      </span>
                    ) : isCheckedIn ? (
                      "+ outra aula"
                    ) : partner ? (
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" /> Check-in
                      </span>
                    ) : (
                      "✅ Check-in"
                    )}
                  </Button>
                </div>
              </div>

              {isExpanded && (
                <div className="mt-3 space-y-1 border-t pt-3 text-xs">
                  {s.goal && (
                    <div>
                      <span className="font-semibold">🎯 Objetivo:</span> {s.goal}
                    </div>
                  )}
                  {s.health_notes && (
                    <div>
                      <span className="font-semibold">⚠️ Saúde/Restrições:</span> {s.health_notes}
                    </div>
                  )}
                  {!s.goal && !s.health_notes && (
                    <div className="text-muted-foreground">
                      Sem objetivo ou observações de saúde registrados.
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
