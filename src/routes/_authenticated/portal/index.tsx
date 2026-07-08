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
        <h1 className="text-2xl font-bold">Agendamento de check-ins</h1>
        <p className="text-sm text-muted-foreground">
          Turmas liberadas pelo seu plano. Faça check-in dentro da janela definida pelo studio.
        </p>
      </div>


      {quota && quota.quota_type !== "none" && quota.quota_amount && (
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Cota do plano ({quota.plan_name})
          </div>
          <div className="text-2xl font-bold mt-1">
            {quota.used}/{quota.quota_amount}
            <span className="text-sm text-muted-foreground font-normal ml-2">
              check-ins {quota.period_label}
            </span>
          </div>
          {quota.package_expires_at && (
            <div className="text-xs text-muted-foreground mt-1">
              Pacote expira em {new Date(quota.package_expires_at).toLocaleDateString("pt-BR")}
            </div>
          )}
        </Card>
      )}

      <AgendaView
        renderCard={(s) => {
          const now = new Date();
          const start = new Date(`${s.session_date}T${String(s.start_time).slice(0, 5)}:00`);
          const opens = new Date(start.getTime() - s.checkin_opens_minutes_before * 60_000);
          const closes = new Date(start.getTime() - s.checkin_closes_minutes_before * 60_000);
          const withinWindow = now >= opens && now <= closes;
          const canCheckIn = s.is_enrolled && !s.checked_in && withinWindow && s.filled < s.capacity;
          const canCancel = s.checked_in && now <= closes;
          const reason = !s.is_enrolled
            ? "Sem acesso pelo plano"
            : s.filled >= s.capacity && !s.checked_in
              ? "Sem vagas"
              : now < opens
                ? `Abre ${opens.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                : now > closes
                  ? "Encerrado"
                  : "";

          return (
            <Card className="p-2 space-y-1 border-l-4" style={{ borderLeftColor: s.program_color ?? "#94a3b8" }}>
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold">{String(s.start_time).slice(0, 5)}</div>
                {s.checked_in && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
              </div>
              <div className="text-sm font-medium truncate">{s.class_name}</div>
              {s.program_name && (
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">
                  {s.program_name}
                </div>
              )}
              <div className={`text-[10px] font-mono ${s.filled >= s.capacity ? "text-destructive" : "text-muted-foreground"}`}>
                {s.filled}/{s.capacity}
              </div>
              {canCheckIn ? (
                <Button size="sm" className="w-full h-7 text-xs" onClick={() => handleCheckIn(s.id)}>
                  Check-in
                </Button>
              ) : canCancel ? (
                <Button size="sm" variant="outline" className="w-full h-7 text-xs" onClick={() => handleCancel(s.id)}>
                  Cancelar
                </Button>
              ) : reason ? (
                <div className="text-[10px] text-muted-foreground text-center py-1">{reason}</div>
              ) : null}
            </Card>
          );
        }}
      />
    </div>
  );
}
