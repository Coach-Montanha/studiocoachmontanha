import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { formatBRL, formatDateBR } from "@/lib/format";
import { CalendarDays, User as UserIcon, Wallet, Activity, Layers, Target } from "lucide-react";

export const Route = createFileRoute("/_authenticated/portal/pt/")({
  head: () => ({ meta: [{ title: "Minhas informações — Personal Trainer" }] }),
  component: PTPortalHome,
});

function PTPortalHome() {
  const { user } = useAuth();

  const { data: student } = useQuery({
    queryKey: ["pt-portal-me", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("pt_students")
        .select("id,name,email,phone,birth_date,start_date,goal,health_notes,status")
        .eq("account_user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["pt-portal-me-payments", student?.id],
    enabled: !!student?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("pt_payments")
        .select("id,amount,payment_date,due_date,status,sessions_paid,pt_plans(name,billing_type,sessions_per_month,package_sessions)")
        .eq("pt_student_id", student!.id)
        .order("payment_date", { ascending: false });
      return data ?? [];
    },
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["pt-portal-me-sessions", student?.id],
    enabled: !!student?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("pt_sessions")
        .select("id,session_date,status,pt_payment_id")
        .eq("pt_student_id", student!.id)
        .order("session_date", { ascending: false });
      return data ?? [];
    },
  });

  if (!student) return <div className="text-sm text-muted-foreground">Carregando…</div>;

  const latestPaid = payments.find((p) => p.status === "paid");
  const plan = latestPaid?.pt_plans;
  const billingType = plan?.billing_type as string | undefined;
  const contracted =
    latestPaid?.sessions_paid ??
    plan?.sessions_per_month ??
    plan?.package_sessions ??
    null;
  const usedInCurrent = latestPaid
    ? sessions.filter((s) => s.status === "completed" && s.pt_payment_id === latestPaid.id).length
    : 0;
  const remaining = contracted !== null && contracted !== undefined ? Math.max(0, contracted - usedInCurrent) : null;
  const totalCompleted = sessions.filter((s) => s.status === "completed").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Olá, {student.name.split(" ")[0]} 👋</h1>
        <p className="text-sm text-muted-foreground">Suas informações e progresso com o Personal Trainer.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <UserIcon className="h-4 w-4 text-primary" /> Meus dados
          </div>
          <InfoRow label="Nome" value={student.name} />
          <InfoRow label="Email" value={student.email} />
          <InfoRow label="Telefone" value={student.phone} />
          <InfoRow label="Nascimento" value={student.birth_date ? formatDateBR(student.birth_date) : null} />
          <InfoRow label="Início" value={student.start_date ? formatDateBR(student.start_date) : null} />
        </Card>

        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Target className="h-4 w-4 text-primary" /> Objetivo
          </div>
          <p className="text-sm">{student.goal || <span className="text-muted-foreground">Não informado</span>}</p>
          {student.health_notes && (
            <>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2">Saúde</div>
              <p className="text-sm">{student.health_notes}</p>
            </>
          )}
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Plano atual <Wallet className="h-4 w-4" />
          </div>
          <div className="mt-2 text-lg font-bold">{plan?.name ?? "—"}</div>
          {latestPaid?.due_date && billingType === "monthly" && (
            <div className="text-xs text-muted-foreground mt-1">
              <CalendarDays className="inline h-3 w-3 mr-1" />
              Vence em {formatDateBR(latestPaid.due_date)}
            </div>
          )}
          {latestPaid && (billingType === "per_session" || billingType === "package") && (
            <div className="text-xs text-muted-foreground mt-1">Vence ao esgotar as aulas</div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Aulas restantes <Layers className="h-4 w-4" />
          </div>
          <div className="mt-2 text-lg font-bold font-mono">
            {remaining !== null && contracted !== null ? `${remaining} de ${contracted}` : "—"}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {contracted !== null ? `${usedInCurrent} realizadas neste ciclo` : "Sem cota definida"}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Total de aulas <Activity className="h-4 w-4" />
          </div>
          <div className="mt-2 text-lg font-bold font-mono">{totalCompleted}</div>
          <div className="text-xs text-muted-foreground mt-1">Realizadas no histórico</div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="mb-3 text-sm font-semibold">Últimos pagamentos</div>
        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum pagamento registrado.</p>
        ) : (
          <ul className="divide-y">
            {payments.slice(0, 6).map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <div className="font-medium">{p.pt_plans?.name ?? "Avulso"}</div>
                  <div className="text-xs text-muted-foreground">{formatDateBR(p.payment_date)}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-semibold">{formatBRL(Number(p.amount))}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{p.status}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value || "—"}</span>
    </div>
  );
}
