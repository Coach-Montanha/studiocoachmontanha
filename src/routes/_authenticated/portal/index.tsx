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

const DOW = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function PortalHome() {
  const { data: me } = useQuery({
    queryKey: ["portal-me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase
        .from("students")
        .select("id,name,email,phone")
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
        .select("start_date,plans(name,price,billing_cycle)")
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

  const { data: myClasses = [] } = useQuery({
    queryKey: ["portal-my-classes", me?.id],
    enabled: !!me?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("class_enrollments")
        .select("classes(id,name,trainer_name,day_of_week,start_time,duration_minutes)")
        .eq("student_id", me!.id)
        .eq("active", true);
      return (data ?? []).map((r: any) => r.classes).filter(Boolean);
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Olá, {me?.name ?? "aluno"} 👋</h1>
        <p className="text-sm text-muted-foreground">Bem-vindo à sua área pessoal</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-muted-foreground uppercase">Plano atual</div>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="mt-2 text-lg font-bold">
            {currentPlan?.plans?.name ?? "Sem plano ativo"}
          </div>
          {currentPlan?.plans?.price && (
            <div className="text-sm text-muted-foreground">
              {formatBRL(Number(currentPlan.plans.price))} / {currentPlan.plans.billing_cycle ?? "mês"}
            </div>
          )}
          <Link to="/portal/plano" className="mt-3 inline-block text-xs text-primary hover:underline">
            Ver detalhes →
          </Link>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-muted-foreground uppercase">Último pagamento</div>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="mt-2 text-lg font-bold">
            {lastPayment ? formatBRL(Number(lastPayment.amount)) : "—"}
          </div>
          <div className="text-sm text-muted-foreground">
            {lastPayment?.payment_date ? formatDateBR(lastPayment.payment_date) : "sem registros"}
          </div>
          <Link to="/portal/pagamentos" className="mt-3 inline-block text-xs text-primary hover:underline">
            Ver histórico →
          </Link>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-muted-foreground uppercase">Minhas turmas</div>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="mt-2 text-lg font-bold">{myClasses.length}</div>
          <div className="text-sm text-muted-foreground">turmas ativas</div>
          <Link to="/portal/turmas" className="mt-3 inline-block text-xs text-primary hover:underline">
            Gerenciar →
          </Link>
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="text-sm font-semibold mb-3">Sua semana</h2>
        {myClasses.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Você ainda não está inscrito em nenhuma turma.{" "}
            <Link to="/portal/turmas" className="text-primary hover:underline">Ver disponíveis</Link>
          </p>
        ) : (
          <ul className="space-y-2">
            {myClasses.map((c: any) => (
              <li key={c.id} className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {DOW[c.day_of_week] ?? "—"} · {String(c.start_time).slice(0, 5)} · {c.duration_minutes} min
                    {c.trainer_name && <> · {c.trainer_name}</>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
