import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AgendaView } from "@/components/edufinance/AgendaView";
import { useServerFn } from "@tanstack/react-start";
import { studentCheckIn, studentCancelCheckIn, getMyQuotaUsage, getMyAttendanceStats, getSessionAttendees } from "@/lib/classes.functions";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, AlertTriangle, Trophy, Users } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDateBR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/portal/")({
  head: () => ({ meta: [{ title: "Agendamento de check-ins — Portal do aluno" }] }),
  loader: ({ context }) => {
    // Prefetch (não-bloqueante) das queries mais pesadas — chega em paralelo com o render do shell.
    const qc = (context as any).queryClient;
    if (qc) {
      qc.prefetchQuery({
        queryKey: ["portal-quota"],
        queryFn: () => getMyQuotaUsage(),
        staleTime: 60_000,
      });
    }
  },
  component: PortalHome,
});

function PortalHome() {
  const qc = useQueryClient();
  const checkIn = useServerFn(studentCheckIn);
  const cancel = useServerFn(studentCancelCheckIn);
  const fetchQuota = useServerFn(getMyQuotaUsage);
  const fetchStats = useServerFn(getMyAttendanceStats);
  const fetchAttendees = useServerFn(getSessionAttendees);

  const { data: quota } = useQuery({
    queryKey: ["portal-quota"],
    queryFn: () => fetchQuota(),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

  const { data: stats } = useQuery({
    queryKey: ["portal-attendance-stats"],
    queryFn: () => fetchStats(),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

  const [attendeesFor, setAttendeesFor] = useState<{ id: string; label: string } | null>(null);
  const { data: attendees = [], isFetching: attendeesLoading } = useQuery({
    queryKey: ["portal-attendees", attendeesFor?.id],
    enabled: !!attendeesFor?.id,
    queryFn: () => fetchAttendees({ data: { sessionId: attendeesFor!.id } }),
  });

  const { data: dueInfo } = useQuery({
    queryKey: ["portal-due-warning"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data: st } = await supabase
        .from("students")
        .select("id")
        .eq("account_user_id", u.user.id)
        .maybeSingle();
      if (!st?.id) return null;
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("payments")
        .select("due_date, plans(name)")
        .eq("student_id", st.id)
        .eq("status", "paid")
        .not("plan_id", "is", null)
        .order("payment_date", { ascending: false })
        .limit(10);
      const current = ((data ?? []) as any[]).find((p) => !p.due_date || p.due_date >= today);
      if (!current?.due_date) return null;
      const due = new Date(`${current.due_date}T12:00:00`);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((due.getTime() - now.getTime()) / 86_400_000);
      return { due_date: current.due_date as string, plan_name: current.plans?.name ?? null, diffDays };
    },
  });

  const [warnOpen, setWarnOpen] = useState(false);
  useEffect(() => {
    if (!dueInfo || dueInfo.diffDays > 3) return;
    const key = `portal-due-warn-${dueInfo.due_date}-${new Date().toISOString().slice(0, 10)}`;
    if (sessionStorage.getItem(key)) return;
    setWarnOpen(true);
    sessionStorage.setItem(key, "1");
  }, [dueInfo]);


  const [pendingId, setPendingId] = useState<string | null>(null);
  async function handleCheckIn(sessionId: string) {
    setPendingId(sessionId);
    try {
      await checkIn({ data: { sessionId } });
      toast.success("Check-in confirmado!");
      // Invalidação cirúrgica — nunca `invalidateQueries()` sem chave.
      qc.invalidateQueries({ queryKey: ["agenda"] });
      qc.invalidateQueries({ queryKey: ["portal-quota"] });
      qc.invalidateQueries({ queryKey: ["portal-attendees", sessionId] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setPendingId(null);
    }
  }
  const [cancelId, setCancelId] = useState<string | null>(null);
  async function handleCancel(sessionId: string) {
    try {
      await cancel({ data: { sessionId } });
      toast.success("Check-in cancelado");
      qc.invalidateQueries({ queryKey: ["agenda"] });
      qc.invalidateQueries({ queryKey: ["portal-quota"] });
      qc.invalidateQueries({ queryKey: ["portal-attendees", sessionId] });
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  // Re-render minutely para atualizar contagem regressiva e estados de janela
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);


  return (
    <div className="space-y-6">
      <Dialog open={warnOpen} onOpenChange={setWarnOpen}>
        <DialogContent className="border-state-pending/50">
          <DialogHeader>
            <div className="mx-auto mb-1 grid h-14 w-14 place-items-center rounded-2xl bg-state-pending-soft text-state-pending ring-1 ring-inset ring-state-pending/20">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <DialogTitle className="text-center">
              {dueInfo && dueInfo.diffDays < 0
                ? "Plano vencido"
                : dueInfo?.diffDays === 0
                  ? "Seu plano vence hoje"
                  : "Vencimento do plano próximo"}
            </DialogTitle>
            <DialogDescription className="text-center">
              {dueInfo?.plan_name && (
                <span className="block font-medium text-foreground">{dueInfo.plan_name}</span>
              )}
              {dueInfo && (
                <span className="mt-1 block">
                  {dueInfo.diffDays < 0
                    ? `Venceu em ${formatDateBR(dueInfo.due_date)}. Regularize com o studio para manter seu acesso.`
                    : dueInfo.diffDays === 0
                      ? `Vence hoje (${formatDateBR(dueInfo.due_date)}). Combine a renovação com o studio.`
                      : `Faltam ${dueInfo.diffDays} ${dueInfo.diffDays === 1 ? "dia" : "dias"} (${formatDateBR(dueInfo.due_date)}) para o vencimento. Combine a renovação com o studio.`}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center gap-2">
            <Button variant="outline" onClick={() => setWarnOpen(false)}>Entendi</Button>
            <Button asChild>
              <Link to="/portal/perfil">Ver meu plano</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <header>
        <p className="text-overline mb-1.5 text-muted-foreground">Studio</p>
        <h1 className="text-title text-foreground">Check-ins</h1>
        <p className="text-caption mt-2 max-w-prose text-muted-foreground">
          Turmas liberadas pelo seu plano. Faça check-in dentro da janela definida pelo studio.
        </p>
      </header>

      {/* Link rápido para treino se for aluno híbrido */}
      {(() => {
        const { user } = useAuth();
        const { data: isPt } = useQuery({
          queryKey: ["is-pt-student", user?.id],
          enabled: !!user?.id,
          queryFn: async () => {
            const { data } = await supabase.from("pt_students").select("id").eq("account_user_id", user!.id).maybeSingle();
            return !!data;
          },
        });
        if (!isPt) return null;
        return (
          <Button asChild variant="secondary" className="w-full gap-2 py-6">
            <Link to="/portal/pt/treino">
              <Dumbbell className="h-5 w-5" />
              Acessar meu Treino Personal
            </Link>
          </Button>
        );
      })()}

      {quota && (quota.plan_name || quota.quota_type !== "none") && (() => {
        const hasQuota = quota.quota_type !== "none" && !!quota.quota_amount;
        const amount = quota.quota_amount ?? 0;
        const used = quota.used ?? 0;
        const pct = hasQuota ? Math.min(100, Math.round((used / amount) * 100)) : 100;
        const deg = (pct / 100) * 360;
        return (
          <Card className="flex items-center gap-4 p-4 sm:p-5">
            <div
              className="relative h-14 w-14 shrink-0 rounded-full flex items-center justify-center"
              style={{ background: `conic-gradient(var(--primary) ${deg}deg, var(--muted) ${deg}deg)` }}
            >
              <div className="absolute inset-[5px] rounded-full bg-card" />
              <span className="text-numeric relative text-xs">
                {hasQuota ? `${used}/${amount}` : "∞"}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-overline text-muted-foreground">
                Plano atual{quota.plan_name ? ` — ${quota.plan_name}` : ""}
              </div>
              <div className="text-body mt-1">
                {hasQuota ? (
                  <>
                    <b className="font-semibold">{used}/{amount} check-ins</b>{" "}
                    <span className="text-muted-foreground">
                      {quota.period_label} — plano permite {amount}
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">Check-ins ilimitados neste plano</span>
                )}
              </div>
              {quota.package_expires_at && (
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Pacote expira em {new Date(quota.package_expires_at).toLocaleDateString("pt-BR")}
                </div>
              )}
            </div>
          </Card>
        );
      })()}

      {stats && (stats.total > 0 || stats.month > 0 || stats.year > 0) && (
        <Card className="flex items-center gap-4 p-4 sm:p-5">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
            <Trophy className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-overline text-muted-foreground">Aulas realizadas</div>
            <div className="mt-1.5 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm">
              <span><b className="text-numeric text-xl text-foreground">{stats.total}</b> <span className="text-muted-foreground">no total</span></span>
              <span><b className="text-numeric text-foreground">{stats.year}</b> <span className="text-muted-foreground">este ano</span></span>
              <span><b className="text-numeric text-foreground">{stats.month}</b> <span className="text-muted-foreground">este mês</span></span>
            </div>
          </div>
        </Card>
      )}

      <ProgramLegend />


      <AgendaView
        renderCard={(s) => {
          const now = new Date();
          const start = new Date(`${s.session_date}T${String(s.start_time).slice(0, 5)}:00`);
          const opens = new Date(start.getTime() - s.checkin_opens_minutes_before * 60_000);
          const closes = new Date(start.getTime() - s.checkin_closes_minutes_before * 60_000);
          const withinWindow = now >= opens && now <= closes;
          const isClosed = now > closes;
          const isSoon = now < opens;
          const isFull = s.filled >= s.capacity;
          const spotsLeft = Math.max(0, s.capacity - s.filled);
          const isLastSpot = !isFull && spotsLeft === 1 && !isClosed && s.is_enrolled && !s.checked_in;
          const canCheckIn = s.is_enrolled && !s.checked_in && withinWindow && !isFull;
          const canCancel = s.checked_in && now <= closes;

          let tag: { label: string; cls: string } | null;
          if (s.checked_in) tag = null;
          else if (!s.is_enrolled) tag = { label: "Sem acesso", cls: "bg-muted text-muted-foreground" };
          else if (isClosed) tag = { label: "Encerrado", cls: "bg-muted text-muted-foreground" };
          else if (isFull) tag = { label: "Sem vagas", cls: "bg-destructive/10 text-destructive" };
          else if (isLastSpot) tag = { label: "Última vaga", cls: "bg-state-pending-soft text-state-pending" };
          else if (isSoon) {
            const diffMin = Math.max(1, Math.round((opens.getTime() - now.getTime()) / 60_000));
            const sameDay = opens.toDateString() === now.toDateString();
            const label =
              diffMin < 60
                ? `Abre em ${diffMin} min`
                : sameDay
                  ? `Abre às ${opens.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                  : `Abre ${opens.toLocaleDateString("pt-BR", { weekday: "short" })} ${opens.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
            tag = { label, cls: "bg-state-pending-soft text-state-pending" };
          }
          else tag = null;


          const dim = isClosed || (!s.is_enrolled && !s.checked_in);
          const [hh, mm] = String(s.start_time).slice(0, 5).split(":");

          const confirmedCls = s.checked_in
            ? "border-l-[6px] bg-state-paid-soft ring-1 ring-state-paid/40"
            : "border-l-4";

          const canOpenAttendees = s.filled > 0;
          const openAttendees = () => {
            if (canOpenAttendees) setAttendeesFor({ id: s.id, label: `${s.class_name} · ${hh}:${mm}` });
          };
          const stop = (e: React.SyntheticEvent) => e.stopPropagation();

          return (
            <Card
              role={canOpenAttendees ? "button" : undefined}
              tabIndex={canOpenAttendees ? 0 : undefined}
              aria-label={canOpenAttendees ? `Ver quem fez check-in em ${s.class_name} às ${hh}:${mm}` : undefined}
              onClick={canOpenAttendees ? openAttendees : undefined}
              onKeyDown={
                canOpenAttendees
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openAttendees();
                      }
                    }
                  : undefined
              }
              className={`transition-ui group relative flex overflow-hidden p-0 outline-none ${confirmedCls} ${dim ? "opacity-60" : ""} ${
                canOpenAttendees
                  ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-float focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-0"
                  : ""
              }`}
              style={{ borderLeftColor: s.program_color ?? "var(--muted-foreground)" }}
            >
              <div className="flex w-16 shrink-0 flex-col items-center justify-center gap-0.5 border-r border-border bg-muted/30 py-3">
                <div className="text-numeric text-xl leading-none text-foreground">{hh}</div>
                <div className="text-numeric text-[11px] text-muted-foreground">:{mm}</div>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="truncate text-sm font-semibold leading-tight text-foreground">{s.class_name}</div>
                  {tag && (
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide ${tag.cls}`}>
                      {tag.label}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium ${
                      isFull
                        ? "bg-destructive/10 text-destructive"
                        : isLastSpot
                          ? "bg-state-pending-soft text-state-pending"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Users className="h-3 w-3" />
                    <b className="text-numeric text-[11px]">{s.filled}/{s.capacity}</b> vagas
                  </span>

                  {canCheckIn ? (
                    <Button
                      size="sm"
                      loading={pendingId === s.id}
                      className="h-9 px-4 text-xs"
                      onClick={(e) => { stop(e); handleCheckIn(s.id); }}
                    >
                      Check-in
                    </Button>
                  ) : canCancel ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 px-4 text-xs"
                      onClick={(e) => { stop(e); setCancelId(s.id); }}
                    >
                      Cancelar
                    </Button>
                  ) : s.checked_in ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-state-paid-soft px-2.5 py-1 text-[11px] font-semibold text-state-paid">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Confirmado
                    </span>
                  ) : s.is_enrolled && isFull && !isClosed ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled
                      title="Em breve: entre na fila para ser avisado se abrir vaga"
                      className="h-9 px-4 text-xs"
                      onClick={stop}
                    >
                      Lista de espera
                    </Button>
                  ) : null}
                </div>
              </div>
            </Card>

          );
        }}
      />

      <AlertDialog open={!!cancelId} onOpenChange={(o) => !o && setCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar check-in?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>Sua vaga será liberada para outro aluno.</p>
                <p className="text-state-paid">
                  ✅ Cancelar antes do encerramento da janela <b>não desconta</b> da sua cota — a aula fica disponível para você reagendar em outra turma dentro do período.
                </p>
                <p className="text-muted-foreground">
                  Depois que a janela de check-in fecha, o botão de cancelar some e a aula passa a contar como frequência normal.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Manter check-in</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (cancelId) handleCancel(cancelId);
                setCancelId(null);
              }}
            >
              Sim, cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!attendeesFor} onOpenChange={(o) => !o && setAttendeesFor(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" /> Quem fez check-in
            </DialogTitle>
            <DialogDescription>{attendeesFor?.label}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] overflow-y-auto">
            {attendeesLoading ? (
              <p className="text-sm text-muted-foreground text-center py-4">Carregando…</p>
            ) : attendees.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Ninguém ainda</p>
            ) : (
              <ul className="divide-y">
                {attendees.map((a) => (
                  <li key={a.student_id} className="flex items-center justify-between py-2 text-sm">
                    <span className="truncate">{a.name}</span>
                    {a.is_me && (
                      <span className="rounded-full bg-state-paid-soft text-state-paid px-2 py-0.5 text-[10px] font-semibold">
                        você
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


function ProgramLegend() {
  const { data: programs = [] } = useQuery({
    queryKey: ["portal-program-legend"],
    queryFn: async () => {
      const { data } = await supabase.from("programs").select("id,name,color").order("name");
      return data ?? [];
    },
  });
  if (programs.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {programs.map((p: any) => (
        <div key={p.id} className="flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: p.color ?? "var(--color-muted-foreground)" }}
          />
          <span className="text-muted-foreground">{p.name}</span>
        </div>
      ))}
    </div>
  );
}
