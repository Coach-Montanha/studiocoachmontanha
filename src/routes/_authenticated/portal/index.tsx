import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AgendaView } from "@/components/edufinance/AgendaView";
import { useServerFn } from "@tanstack/react-start";
import { studentCheckIn, studentCancelCheckIn, getMyQuotaUsage } from "@/lib/classes.functions";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDateBR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/portal/")({
  head: () => ({ meta: [{ title: "Agendamento de check-ins — Portal do aluno" }] }),
  component: PortalHome,
});

function PortalHome() {
  const qc = useQueryClient();
  const checkIn = useServerFn(studentCheckIn);
  const cancel = useServerFn(studentCancelCheckIn);
  const fetchQuota = useServerFn(getMyQuotaUsage);

  const { data: quota } = useQuery({
    queryKey: ["portal-quota"],
    queryFn: () => fetchQuota(),
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


  async function handleCheckIn(sessionId: string) {
    try {
      await checkIn({ data: { sessionId } });
      toast.success("Check-in confirmado!");
      qc.invalidateQueries();
    } catch (e: any) {
      toast.error(e.message);
    }
  }
  async function handleCancel(sessionId: string) {
    try {
      await cancel({ data: { sessionId } });
      toast.success("Check-in cancelado");
      qc.invalidateQueries();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <div className="space-y-6">
      <Dialog open={warnOpen} onOpenChange={setWarnOpen}>
        <DialogContent className="border-amber-500/60">
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">
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

      <div>
        <h1 className="text-2xl font-bold">Check-ins</h1>
        <p className="text-sm text-muted-foreground">
          Turmas liberadas pelo seu plano. Faça check-in dentro da janela definida pelo studio.
        </p>
      </div>

      {quota && (quota.plan_name || quota.quota_type !== "none") && (() => {
        const hasQuota = quota.quota_type !== "none" && !!quota.quota_amount;
        const amount = quota.quota_amount ?? 0;
        const used = quota.used ?? 0;
        const pct = hasQuota ? Math.min(100, Math.round((used / amount) * 100)) : 100;
        const deg = (pct / 100) * 360;
        return (
          <Card className="p-4 flex items-center gap-4">
            <div
              className="relative h-14 w-14 shrink-0 rounded-full flex items-center justify-center"
              style={{ background: `conic-gradient(hsl(var(--primary)) ${deg}deg, hsl(var(--muted)) ${deg}deg)` }}
            >
              <div className="absolute inset-[5px] rounded-full bg-card" />
              <span className="relative text-xs font-bold">
                {hasQuota ? `${used}/${amount}` : "∞"}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                Plano atual{quota.plan_name ? ` — ${quota.plan_name}` : ""}
              </div>
              <div className="text-sm mt-0.5">
                {hasQuota ? (
                  <>
                    <b className="font-semibold">{Math.max(0, amount - used)} check-in(s)</b>{" "}
                    <span className="text-muted-foreground">
                      disponíveis {quota.period_label} · {used} realizado{used === 1 ? "" : "s"}
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
          const canCheckIn = s.is_enrolled && !s.checked_in && withinWindow && !isFull;
          const canCancel = s.checked_in && now <= closes;

          let tag: { label: string; cls: string };
          if (s.checked_in) tag = { label: "Confirmado", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" };
          else if (!s.is_enrolled) tag = { label: "Sem acesso", cls: "bg-muted text-muted-foreground" };
          else if (isClosed) tag = { label: "Encerrado", cls: "bg-muted text-muted-foreground" };
          else if (isFull) tag = { label: "Sem vagas", cls: "bg-destructive/10 text-destructive" };
          else if (isSoon) tag = { label: "Abre em breve", cls: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" };
          else tag = { label: "Aberto", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" };

          const dim = isClosed || (!s.is_enrolled && !s.checked_in);
          const [hh, mm] = String(s.start_time).slice(0, 5).split(":");

          return (
            <Card
              className={`flex overflow-hidden border-l-4 p-0 ${dim ? "opacity-60" : ""}`}
              style={{ borderLeftColor: s.program_color ?? "hsl(var(--muted-foreground))" }}
            >
              <div className="flex w-14 shrink-0 flex-col items-center justify-center border-r py-2">
                <div className="text-lg font-bold leading-none tabular-nums">{hh}</div>
                <div className="text-[11px] font-semibold text-muted-foreground">:{mm}</div>
              </div>
              <div className="flex flex-1 flex-col gap-1.5 p-2.5 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold truncate">{s.class_name}</div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide ${tag.cls}`}>
                    {tag.label}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className={`text-xs font-medium ${isFull ? "text-destructive" : "text-muted-foreground"}`}>
                    <b className="text-foreground font-semibold">{s.filled}</b>/{s.capacity} vagas
                  </div>
                  {canCheckIn ? (
                    <Button size="sm" className="h-7 px-3 text-xs" onClick={() => handleCheckIn(s.id)}>
                      Check-in
                    </Button>
                  ) : canCancel ? (
                    <Button size="sm" variant="outline" className="h-7 px-3 text-xs" onClick={() => handleCancel(s.id)}>
                      Cancelar
                    </Button>
                  ) : s.checked_in ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Confirmado
                    </span>
                  ) : null}
                </div>
              </div>
            </Card>
          );
        }}
      />
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
            style={{ background: p.color ?? "hsl(var(--muted-foreground))" }}
          />
          <span className="text-muted-foreground">{p.name}</span>
        </div>
      ))}
    </div>
  );
}
