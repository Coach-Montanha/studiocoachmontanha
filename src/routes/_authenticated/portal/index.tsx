import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AgendaView } from "@/components/edufinance/AgendaView";
import { useServerFn } from "@tanstack/react-start";
import { studentCheckIn, studentCancelCheckIn, getMyQuotaUsage } from "@/lib/classes.functions";
import { CheckCircle2 } from "lucide-react";

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
