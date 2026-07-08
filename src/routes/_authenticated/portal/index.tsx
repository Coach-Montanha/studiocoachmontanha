import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { formatBRL, formatDateBR } from "@/lib/format";
import { CreditCard, ClipboardList, Calendar } from "lucide-react";

export const Route = createFileRoute("/_authenticated/portal/")({
  head: () => ({ meta: [{ title: "Portal do Aluno" }] }),
  component: PortalHome,
});

function startOfWeek(d: Date): Date {
  const day = d.getDay();
  const diffToMonday = (day + 6) % 7;
  const s = new Date(d);
  s.setDate(d.getDate() - diffToMonday);
  s.setHours(0, 0, 0, 0);
  return s;
}
function endOfWeek(d: Date): Date {
  const s = startOfWeek(d);
  const e = new Date(s);
  e.setDate(s.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
}
const DOW = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function PortalHome() {
  const { data: me } = useQuery({
    queryKey: ["portal-me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase
        .from("students")
        .select("id,name")
        .eq("account_user_id", u.user.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: currentPlan } = useQuery({
    queryKey: ["portal-current-plan", me?.id],
    enabled: !!me?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("student_plan_history")
        .select("start_date,plans(name,price,billing_cycle,description)")
        .eq("student_id", me!.id)
        .eq("is_current", true)
        .maybeSingle();
      return data as any;
    },
  });

  const { data: lastPayment } = useQuery({
    queryKey: ["portal-last-payment", me?.id],
    enabled: !!me?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("amount,payment_date,due_date,status,reference_month")
        .eq("student_id", me!.id)
        .order("payment_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const now = new Date();
  const weekFrom = startOfWeek(now).toISOString().slice(0, 10);
  const weekTo = endOfWeek(now).toISOString().slice(0, 10);

  const { data: weekAttendance = [] } = useQuery({
    queryKey: ["portal-week-attendance", me?.id, weekFrom, weekTo],
    enabled: !!me?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("class_attendance")
        .select(`
          id, status, checked_in_at,
          class_sessions:session_id (
            session_date, start_time, duration_minutes,
            classes:class_id ( name, trainer_name, programs:program_id ( name, color ) )
          )
        `)
        .eq("student_id", me!.id);
      return (data ?? []).filter((r: any) => {
        const d = r.class_sessions?.session_date;
        return d && d >= weekFrom && d <= weekTo;
      });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Olá, {me?.name ?? "aluno"} 👋</h1>
        <p className="text-sm text-muted-foreground">Bem-vindo à sua área pessoal</p>
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
          <ClipboardList className="h-4 w-4" /> Plano atual
        </div>
        {currentPlan ? (
          <div className="mt-3 space-y-1">
            <div className="text-2xl font-bold">{currentPlan.plans?.name}</div>
            <div className="text-sm text-muted-foreground">
              {formatBRL(Number(currentPlan.plans?.price ?? 0))} / {currentPlan.plans?.billing_cycle ?? "mês"}
            </div>
            {currentPlan.plans?.description && (
              <p className="text-sm mt-2">{currentPlan.plans.description}</p>
            )}
            <div className="grid gap-3 sm:grid-cols-2 mt-4 pt-4 border-t">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                  <CreditCard className="h-3 w-3" /> Último pagamento
                </div>
                <div className="text-base font-semibold mt-1">
                  {lastPayment?.payment_date ? formatDateBR(lastPayment.payment_date) : "—"}
                </div>
                {lastPayment?.amount != null && (
                  <div className="text-xs text-muted-foreground">
                    {formatBRL(Number(lastPayment.amount))}
                  </div>
                )}
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Vencimento</div>
                <div className="text-base font-semibold mt-1">
                  {lastPayment?.due_date ? formatDateBR(lastPayment.due_date) : "—"}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-3 text-sm text-muted-foreground">
            Você ainda não tem um plano ativo. Fale com o studio.
          </div>
        )}
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
          <Calendar className="h-4 w-4" /> Aulas efetuadas nesta semana
        </div>
        {weekAttendance.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Nenhuma aula efetuada esta semana ainda.{" "}
            <Link to="/portal/agenda" className="text-primary hover:underline">
              Ver agenda
            </Link>
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {weekAttendance.map((r: any) => {
              const s = r.class_sessions;
              const c = s?.classes;
              const color = c?.programs?.color ?? "#94a3b8";
              const d = s?.session_date ? new Date(`${s.session_date}T12:00:00`) : null;
              return (
                <li
                  key={r.id}
                  className="flex items-center justify-between rounded-md border p-3 border-l-4"
                  style={{ borderLeftColor: color }}
                >
                  <div>
                    <div className="font-medium">{c?.name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {d ? `${DOW[d.getDay()]} ${d.toLocaleDateString("pt-BR")}` : "—"} ·{" "}
                      {String(s?.start_time ?? "").slice(0, 5)} · {s?.duration_minutes ?? 0} min
                      {c?.trainer_name && <> · {c.trainer_name}</>}
                    </div>
                    {c?.programs?.name && (
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">
                        {c.programs.name}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
