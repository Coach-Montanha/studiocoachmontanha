import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatBRL, formatDateBR } from "@/lib/format";
import { ChevronDown, ChevronUp, CalendarCheck, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/portal/perfil")({
  head: () => ({ meta: [{ title: "Meus dados" }] }),
  component: PerfilPage,
});

function PerfilPage() {
  const [showHistory, setShowHistory] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: userTypes } = useQuery({
    queryKey: ["portal-user-types"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return { studio: false, pt: false, userId: null };
      const [studio, pt] = await Promise.all([
        supabase.from("students").select("id").eq("account_user_id", u.user.id).maybeSingle(),
        supabase.from("pt_students").select("id").eq("account_user_id", u.user.id).maybeSingle(),
      ]);
      return { 
        studio: !!studio.data, 
        pt: !!pt.data, 
        studioId: studio.data?.id, 
        ptId: pt.data?.id,
        userId: u.user.id 
      };
    },
  });

  const { data: studioMe } = useQuery({
    queryKey: ["portal-me-studio", userTypes?.studioId],
    enabled: !!userTypes?.studioId,
    queryFn: async () => {
      const { data } = await supabase
        .from("students")
        .select("id,name,email,phone,birth_date,status,created_at")
        .eq("id", userTypes!.studioId!)
        .single();
      return data;
    },
  });

  const { data: ptMe } = useQuery({
    queryKey: ["portal-me-pt", userTypes?.ptId],
    enabled: !!userTypes?.ptId,
    queryFn: async () => {
      const { data } = await supabase
        .from("pt_students")
        .select("id,name,email,phone,birth_date,status,created_at,start_date,goal,health_notes")
        .eq("id", userTypes!.ptId!)
        .single();
      return data;
    },
  });

  const me = studioMe || ptMe;

  const { data: currentPayment } = useQuery({
    queryKey: ["perfil-current-payment", me?.id],
    enabled: !!me?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("amount,payment_date,due_date,status,plans(name,price,billing_cycle,description)")
        .eq("student_id", me!.id)
        .eq("status", "paid")
        .not("plan_id", "is", null)
        .order("payment_date", { ascending: false })
        .limit(10);
      const today = new Date().toISOString().slice(0, 10);
      return ((data ?? []) as any[]).find((p) => !p.due_date || p.due_date >= today) ?? null;
    },
  });

  const { data: planHistory = [] } = useQuery({
    queryKey: ["perfil-plan-history", me?.id],
    enabled: !!me?.id && showHistory,
    queryFn: async () => {
      const { data } = await supabase
        .from("student_plan_history")
        .select("id,start_date,end_date,is_current,plans(name,price,billing_cycle)")
        .eq("student_id", me!.id)
        .order("start_date", { ascending: false });
      return (data ?? []) as any[];
    },
  });

  const { data: paymentsHistory = [] } = useQuery({
    queryKey: ["perfil-payments-history", userTypes?.studioId],
    enabled: !!userTypes?.studioId && showHistory,
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("id,amount,payment_date,due_date,status,reference_month,payment_method")
        .eq("student_id", userTypes!.studioId!)
        .order("payment_date", { ascending: false });
      return data ?? [];
    },
  });

  const { data: ptPaymentsHistory = [] } = useQuery({
    queryKey: ["perfil-pt-payments-history", userTypes?.ptId],
    enabled: !!userTypes?.ptId && showHistory,
    queryFn: async () => {
      const { data } = await supabase
        .from("pt_payments")
        .select("id,amount,payment_date,due_date,status,pt_plans(name)")
        .eq("pt_student_id", userTypes!.ptId!)
        .order("payment_date", { ascending: false });
      return data ?? [];
    },
  });

  const [showAllCheckins, setShowAllCheckins] = useState(false);
  const { data: checkins = [], isLoading: loadingCheckins } = useQuery({
    queryKey: ["perfil-checkins", userTypes?.studioId],
    enabled: !!userTypes?.studioId,
    queryFn: async () => {
      const { data } = await supabase
        .from("class_attendance")
        .select("id,created_at,class_sessions(session_date,start_time,classes(name,programs(name,color)))")
        .eq("student_id", userTypes!.studioId!)
        .order("created_at", { ascending: false })
        .limit(50);
      return (data ?? []) as any[];
    },
  });

  async function changePassword() {
    if (newPassword.length < 6) return toast.error("Mínimo 6 caracteres");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Senha atualizada!");
    setNewPassword("");
  }

  const statusBadge = (status: string) => {
    if (status === "paid") return <Badge className="border-state-paid/30 bg-state-paid-soft text-state-paid">Pago</Badge>;
    if (status === "pending") return <Badge variant="secondary">Pendente</Badge>;
    if (status === "overdue") return <Badge variant="destructive">Vencido</Badge>;
    return <Badge variant="outline">{status}</Badge>;
  };

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <p className="text-overline mb-1.5 text-muted-foreground">Área do aluno</p>
        <h1 className="text-title text-foreground">Meus dados</h1>
      </header>

      {/* Dados pessoais */}
      <Card className="space-y-4 p-5 sm:p-6">
        <h2 className="text-overline text-muted-foreground">Dados pessoais</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-overline text-muted-foreground">Nome</Label>
            <div className="text-body text-foreground">{me?.name ?? "—"}</div>
          </div>
          <div>
            <Label className="text-overline text-muted-foreground">Email</Label>
            <div className="text-body text-foreground">{me?.email ?? "—"}</div>
          </div>
          <div>
            <Label className="text-overline text-muted-foreground">Telefone</Label>
            <div className="text-body text-foreground">{me?.phone ?? "—"}</div>
          </div>
          <div>
            <Label className="text-overline text-muted-foreground">Nascimento</Label>
            <div className="text-body text-foreground">{me?.birth_date ? formatDateBR(me.birth_date) : "—"}</div>
          </div>
          <div>
            <Label className="text-overline text-muted-foreground">Aluno desde</Label>
            <div className="text-body text-foreground">{me?.created_at ? formatDateBR(me.created_at) : "—"}</div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground pt-2 border-t">
          Para alterar seus dados, entre em contato com o studio.
        </p>
      </Card>

      {/* Informações de planos */}
      <div className="grid gap-6">
        {userTypes?.studio && (
          <Card className="space-y-4 p-5 sm:p-6">
            <h2 className="text-overline text-muted-foreground">Studio — Plano e Financeiro</h2>
            {currentPayment ? (
              <div className="space-y-1">
                <div>
                  <Label className="text-overline text-muted-foreground">Plano atual</Label>
                  <div className="text-lg font-semibold">{currentPayment.plans?.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {formatBRL(Number(currentPayment.plans?.price ?? currentPayment.amount ?? 0))} / {currentPayment.plans?.billing_cycle ?? "mês"}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3 pt-3 mt-2 border-t">
                  <div>
                    <Label className="text-overline text-muted-foreground">Valor pago</Label>
                    <div className="text-base font-medium">
                      {currentPayment.amount != null ? formatBRL(Number(currentPayment.amount)) : "—"}
                    </div>
                  </div>
                  <div>
                    <Label className="text-overline text-muted-foreground">Data do pagamento</Label>
                    <div className="text-base font-medium">
                      {currentPayment.payment_date ? formatDateBR(currentPayment.payment_date) : "—"}
                    </div>
                  </div>
                  <div>
                    <Label className="text-overline text-muted-foreground">Vencimento</Label>
                    <div className="text-base font-medium">
                      {currentPayment.due_date ? formatDateBR(currentPayment.due_date) : "—"}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sem plano de Studio ativo</p>
            )}

            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="transition-ui mt-3 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {showHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {showHistory ? "Ocultar histórico Studio" : "Ver histórico Studio"}
            </button>

            {showHistory && (
              <div className="pt-3 border-t space-y-4">
                <div>
                  <h3 className="text-overline mb-2 text-muted-foreground">Histórico de planos Studio</h3>
                  {planHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum plano registrado</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {planHistory.map((h: any) => (
                        <li key={h.id} className="transition-ui flex items-center justify-between rounded-xl border border-border bg-card/60 p-3 text-sm hover:bg-muted/40">
                          <div>
                            <div className="font-medium">
                              {h.plans?.name} {h.is_current && <Badge className="ml-1 border-state-paid/30 bg-state-paid-soft text-[10px] text-state-paid">atual</Badge>}
                            </div>
                            <div className="text-xs text-muted-foreground">{formatDateBR(h.start_date)} — {h.end_date ? formatDateBR(h.end_date) : "atual"}</div>
                          </div>
                          <div className="text-numeric text-xs">{formatBRL(Number(h.plans?.price ?? 0))}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <h3 className="text-overline mb-2 text-muted-foreground">Histórico de pagamentos Studio</h3>
                  {paymentsHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum pagamento registrado</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {paymentsHistory.map((p: any) => (
                        <li key={p.id} className="transition-ui flex items-center justify-between rounded-xl border border-border bg-card/60 p-3 text-sm hover:bg-muted/40">
                          <div>
                            <div className="font-medium">{p.reference_month ?? formatDateBR(p.payment_date)}</div>
                            <div className="text-xs text-muted-foreground">Pago em {formatDateBR(p.payment_date)}{p.due_date && <> · vence {formatDateBR(p.due_date)}</>}{p.payment_method && <> · {p.payment_method}</>}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            {statusBadge(p.status)}
                            <span className="text-numeric text-xs">{formatBRL(Number(p.amount))}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </Card>
        )}

        {userTypes?.pt && (
          <Card className="space-y-4 p-5 sm:p-6">
            <h2 className="text-overline text-muted-foreground">Personal Trainer — Plano e Financeiro</h2>
            <div className="space-y-4">
              {ptMe?.goal && (
                <div>
                  <Label className="text-overline text-muted-foreground">Objetivo</Label>
                  <p className="text-sm">{ptMe.goal}</p>
                </div>
              )}
              {ptPaymentsHistory.length > 0 ? (
                <div>
                  <Label className="text-overline text-muted-foreground">Últimos Pagamentos PT</Label>
                  <ul className="mt-2 space-y-1.5">
                    {ptPaymentsHistory.slice(0, 5).map((p: any) => (
                      <li key={p.id} className="transition-ui flex items-center justify-between rounded-xl border border-border bg-card/60 p-3 text-sm hover:bg-muted/40">
                        <div>
                          <div className="font-medium">{p.pt_plans?.name ?? "Personal Trainer"}</div>
                          <div className="text-xs text-muted-foreground">Pago em {formatDateBR(p.payment_date)}{p.due_date && <> · vence {formatDateBR(p.due_date)}</>}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          {statusBadge(p.status)}
                          <span className="text-numeric text-xs">{formatBRL(Number(p.amount))}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum pagamento de PT registrado</p>
              )}
            </div>
          </Card>
        )}
      </div>

      {/* Histórico de check-ins */}
      <Card className="space-y-4 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-semibold leading-tight text-foreground">Histórico de check-ins</h2>
          </div>
          {checkins.length > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {checkins.length} {checkins.length === 1 ? "registro" : "registros"}
            </span>
          )}
        </div>

        {loadingCheckins ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 rounded-lg bg-muted/50 animate-pulse" />
            ))}
          </div>
        ) : checkins.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-8 text-center">
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
              <CalendarCheck className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium">Sem check-ins ainda</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              Seus check-ins aparecerão aqui após confirmar presença nas turmas.
            </p>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-border rounded-lg border">
              {(showAllCheckins ? checkins : checkins.slice(0, 10)).map((c: any) => {
                const session = c.class_sessions;
                const cls = session?.classes;
                const prog = cls?.programs;
                const dateStr = session?.session_date ?? c.created_at;
                const d = new Date(dateStr);
                const day = d.getDate();
                const month = d
                  .toLocaleDateString("pt-BR", { month: "short" })
                  .replace(".", "");
                const time = session?.start_time
                  ? String(session.start_time).slice(0, 5)
                  : new Date(c.created_at).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                return (
                  <li
                    key={c.id}
                    className="flex items-center gap-3 px-3 py-3 transition-colors duration-150 hover:bg-muted/40"
                  >
                    <div className="flex w-10 flex-col items-center leading-none">
                      <span className="text-lg font-bold tabular-nums">{day}</span>
                      <span className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                        {month}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {cls?.name ?? "Turma"}
                      </div>
                      {prog?.name && (
                        <span
                          className="mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                          style={
                            prog?.color
                              ? {
                                  backgroundColor: `${prog.color}22`,
                                  color: prog.color,
                                }
                              : undefined
                          }
                        >
                          {prog.name}
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                      {time}
                    </span>
                  </li>
                );
              })}
            </ul>
            {checkins.length > 10 && (
              <button
                type="button"
                onClick={() => setShowAllCheckins((v) => !v)}
                className="flex items-center gap-1 text-xs text-primary transition-colors duration-150 hover:underline"
              >
                {showAllCheckins ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
                {showAllCheckins ? "Mostrar menos" : `Ver todos (${checkins.length})`}
              </button>
            )}
          </>
        )}
      </Card>

      {/* Alterar senha */}
      <Card className="space-y-4 p-5 sm:p-6">
        <h2 className="text-overline text-muted-foreground">Alterar senha</h2>
        <div className="space-y-1.5">
          <Label>Nova senha</Label>
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <Button onClick={changePassword} disabled={loading}>
          {loading ? "Salvando…" : "Atualizar senha"}
        </Button>
      </Card>
    </div>
  );
}
