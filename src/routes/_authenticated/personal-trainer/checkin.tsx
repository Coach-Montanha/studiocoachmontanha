import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, Search, Zap, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PTStudentStatusBadge } from "@/components/pt/PTBadges";
import { initials } from "@/lib/format";
import { addSessionToCalendar } from "@/lib/gcal";
import { cn } from "@/lib/utils";

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

function CheckinPage() {
  const qc = useQueryClient();
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


  const { data: students = [] } = useQuery({
    queryKey: ["pt-students-checkin"],
    queryFn: async () =>
      (await supabase
        .from("pt_students")
        .select("id,name,phone,status,goal,health_notes,pt_payments(id,amount,payment_date,status,sessions_paid,reference_month,pt_plans(name,sessions_per_month))")
        .eq("status", "active")
        .order("name")
      ).data ?? [],
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const { data: usedCounts = [] } = useQuery({
    queryKey: ["pt-sessions-used-counts"],
    queryFn: async () =>
      (await supabase
        .from("pt_sessions")
        .select("pt_payment_id")
        .not("pt_payment_id", "is", null)
      ).data ?? [],
  });


  const { data: todaySessions = [], refetch: refetchSessions } = useQuery({
    queryKey: ["pt-today-sessions", today],
    queryFn: async () =>
      (await supabase
        .from("pt_sessions")
        .select("id,pt_student_id,session_time,duration_minutes,status,pt_students(name)")
        .eq("session_date", today)
        .order("session_time")
      ).data ?? [],
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

  const balanceMap = useMemo(() => {
    const usedByPayment = new Map<string, number>();
    for (const row of usedCounts as any[]) {
      const pid = row.pt_payment_id;
      if (!pid) continue;
      usedByPayment.set(pid, (usedByPayment.get(pid) ?? 0) + 1);
    }
    const map = new Map<string, { contracted: number; used: number; remaining: number }>();
    for (const s of students as any[]) {
      let contracted = 0;
      let used = 0;
      for (const p of s.pt_payments ?? []) {
        if (p.status !== "paid") continue;
        const c = p.pt_plans?.sessions_per_month ?? p.sessions_paid ?? 0;
        contracted += Number(c) || 0;
        used += usedByPayment.get(p.id) ?? 0;
      }
      map.set(s.id, { contracted, used, remaining: Math.max(0, contracted - used) });
    }
    return map;
  }, [students, usedCounts]);


  async function handleCheckin(student: any) {
    setCheckingIn(student.id);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Usuário não autenticado");

      const latestPayment = [...(student.pt_payments ?? [])]
        .filter((p: any) => p.status === "paid")
        .sort((a: any, b: any) => (a.payment_date < b.payment_date ? 1 : -1))[0];

      const { data, error } = await supabase
        .from("pt_sessions")
        .insert({
          user_id: userId,
          pt_student_id: student.id,
          pt_payment_id: latestPayment?.id ?? null,
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
      toast.success(`✅ Check-in de ${student.name} registrado!`);
      qc.invalidateQueries();
      refetchSessions();

      // Send WhatsApp notification if enabled
      if (sendWhatsApp && student.phone) {
        const sessionNumber = (todaySessions.filter(
          (s: any) => s.pt_student_id === student.id
        ).length) + 1;

        const bal = balanceMap.get(student.id);
        const remaining = bal
          ? Math.max(0, bal.remaining - 1)
          : null;

        const dateLabel = new Date().toLocaleDateString("pt-BR", {
          weekday: "long",
          day: "2-digit",
          month: "long",
        });
        const timeLabel = sessionTime;

        const lines: string[] = [
          `Olá ${student.name}! ✅`,
          ``,
          `Seu check-in foi registrado com sucesso!`,
          ``,
          `📅 *Data:* ${dateLabel}`,
          `🕐 *Horário:* ${timeLabel}`,
          `🏃 *Aula nº:* ${sessionNumber} de hoje`,
        ];

        if (bal && bal.contracted) {
          lines.push(`📦 *Pacote:* ${bal.used + 1}/${bal.contracted} aulas realizadas`);
          if (remaining !== null && remaining > 0) {
            lines.push(`✨ *Restam:* ${remaining} aula(s) no pacote`);
          } else if (remaining === 0) {
            lines.push(`⚠️ *Atenção:* Esta foi a última aula do seu pacote. Renove para continuar treinando!`);
          }
        }

        lines.push(``);
        lines.push(`Bom treino! 💪`);

        const whatsappMessage = lines.join("\n");
        const phone = student.phone.replace(/\D/g, "");
        const url = `https://wa.me/55${phone}?text=${encodeURIComponent(whatsappMessage)}`;
        window.open(url, "_blank");
      } else if (sendWhatsApp && !student.phone) {
        toast.warning(`${student.name} não tem telefone cadastrado — WhatsApp não enviado.`);
      }


      // Offer to add to Google Calendar
      const gcalClientId = localStorage.getItem("edufinance.gcalClientId");
      if (gcalClientId) {
        const addToCalendar = window.confirm(
          `Adicionar aula de ${student.name} ao Google Calendar?`,
        );
        if (addToCalendar) {
          addSessionToCalendar({
            studentName: student.name,
            sessionDate: today,
            sessionTime: sessionTime,
            durationMinutes: Number(duration),
          });
        }
      }
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    }
    setCheckingIn(null);
  }

  async function undoCheckin(sessionId: string, studentName: string) {
    if (!confirm(`Desfazer check-in de ${studentName}?`)) return;
    const { error } = await supabase.from("pt_sessions").delete().eq("id", sessionId);
    if (error) return toast.error(error.message);
    setCheckedIn((prev) => prev.filter((c) => c.sessionId !== sessionId));
    toast.success("Check-in desfeito.");
    qc.invalidateQueries();
    refetchSessions();
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <Zap className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Check-in Rápido</h1>
        </div>
        <p className="text-sm text-muted-foreground capitalize">{todayLabel}</p>
      </div>

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
        </div>
        <p className="text-xs text-muted-foreground">
          Todos os check-ins desta sessão usarão esses valores. Você pode ajustar individualmente depois na página do aluno.
        </p>
      </Card>

      {todaySessions.length > 0 && (
        <Card className="p-3 bg-emerald-50 border-emerald-200">
          <div className="mb-2 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-700" />
            <span className="text-sm font-semibold text-emerald-800">
              {todaySessions.length} aula(s) registrada(s) hoje
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {todaySessions.map((s: any) => {
              const localResult = checkedIn.find((c) => c.sessionId === s.id);
              return (
                <div key={s.id} className="flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-xs">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
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
          placeholder="Buscar aluno..."
          className="pl-9 h-11"
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

          return (
            <Card key={s.id} className="p-3">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    isCheckedIn ? "bg-emerald-100 text-emerald-700" : "bg-primary/10 text-primary"
                  )}
                >
                  {isCheckedIn ? <CheckCircle2 className="h-5 w-5" /> : initials(s.name)}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{s.name}</span>
                    <PTStudentStatusBadge status={s.status} />
                    {isCheckedIn && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                        ✅ {todayCount} aula(s) hoje
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {planName && <span>📋 {planName}</span>}
                    {sessionsPerMonth && <span>🏃 {sessionsPerMonth} aulas/mês</span>}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setExpandedStudent(isExpanded ? null : s.id)}
                    className="p-1 text-muted-foreground hover:text-foreground"
                  >
                    <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
                  </button>
                  <Button
                    size="sm"
                    variant={isCheckedIn ? "outline" : "default"}
                    disabled={isLoading}
                    onClick={() => handleCheckin(s)}
                    className={cn(
                      "min-w-[100px]",
                      isCheckedIn && "border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                    )}
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 animate-spin" /> Registrando…
                      </span>
                    ) : isCheckedIn ? (
                      "+ outra aula"
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
