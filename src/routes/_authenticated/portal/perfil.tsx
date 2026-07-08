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
import { ChevronDown, ChevronUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/portal/perfil")({
  head: () => ({ meta: [{ title: "Meus dados" }] }),
  component: PerfilPage,
});

function PerfilPage() {
  const [showHistory, setShowHistory] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: me } = useQuery({
    queryKey: ["portal-me-full"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase
        .from("students")
        .select("id,name,email,phone,birth_date,status,created_at")
        .eq("account_user_id", u.user.id)
        .maybeSingle();
      return data;
    },
  });

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
    queryKey: ["perfil-payments-history", me?.id],
    enabled: !!me?.id && showHistory,
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("id,amount,payment_date,due_date,status,reference_month,payment_method")
        .eq("student_id", me!.id)
        .order("payment_date", { ascending: false });
      return data ?? [];
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
    if (status === "paid") return <Badge className="bg-emerald-500">Pago</Badge>;
    if (status === "pending") return <Badge variant="secondary">Pendente</Badge>;
    if (status === "overdue") return <Badge variant="destructive">Vencido</Badge>;
    return <Badge variant="outline">{status}</Badge>;
  };

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Meus dados</h1>

      {/* Dados pessoais */}
      <Card className="p-6 space-y-3">
        <h2 className="text-sm font-semibold">Dados pessoais</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs text-muted-foreground">Nome</Label>
            <div className="text-base">{me?.name ?? "—"}</div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Email</Label>
            <div className="text-base">{me?.email ?? "—"}</div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Telefone</Label>
            <div className="text-base">{me?.phone ?? "—"}</div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Nascimento</Label>
            <div className="text-base">{me?.birth_date ? formatDateBR(me.birth_date) : "—"}</div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Aluno desde</Label>
            <div className="text-base">{me?.created_at ? formatDateBR(me.created_at) : "—"}</div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground pt-2 border-t">
          Para alterar seus dados, entre em contato com o studio.
        </p>
      </Card>

      {/* Informações de planos */}
      <Card className="p-6 space-y-3">
        <h2 className="text-sm font-semibold">Informações de planos</h2>
        {currentPayment ? (
          <div className="space-y-1">
            <div>
              <Label className="text-xs text-muted-foreground">Plano atual</Label>
              <div className="text-lg font-semibold">{currentPayment.plans?.name}</div>
              <div className="text-sm text-muted-foreground">
                {formatBRL(Number(currentPayment.plans?.price ?? currentPayment.amount ?? 0))} / {currentPayment.plans?.billing_cycle ?? "mês"}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 pt-3 mt-2 border-t">
              <div>
                <Label className="text-xs text-muted-foreground">Valor pago</Label>
                <div className="text-base font-medium">
                  {currentPayment.amount != null ? formatBRL(Number(currentPayment.amount)) : "—"}
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Data do pagamento</Label>
                <div className="text-base font-medium">
                  {currentPayment.payment_date ? formatDateBR(currentPayment.payment_date) : "—"}
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Vencimento</Label>
                <div className="text-base font-medium">
                  {currentPayment.due_date ? formatDateBR(currentPayment.due_date) : "—"}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Sem plano ativo</p>
        )}

        <button
          type="button"
          onClick={() => setShowHistory((v) => !v)}
          className="mt-3 flex items-center gap-1 text-xs text-primary hover:underline"
        >
          {showHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {showHistory ? "Ocultar histórico" : "Ver mais (histórico de planos e pagamentos)"}
        </button>

        {showHistory && (
          <div className="pt-3 border-t space-y-4">
            <div>
              <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                Histórico de planos
              </h3>
              {planHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum plano registrado</p>
              ) : (
                <ul className="space-y-1.5">
                  {planHistory.map((h: any) => (
                    <li
                      key={h.id}
                      className="flex items-center justify-between rounded-md border p-2 text-sm"
                    >
                      <div>
                        <div className="font-medium">
                          {h.plans?.name}{" "}
                          {h.is_current && (
                            <Badge className="ml-1 bg-emerald-500 text-[10px]">atual</Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDateBR(h.start_date)} —{" "}
                          {h.end_date ? formatDateBR(h.end_date) : "atual"}
                        </div>
                      </div>
                      <div className="font-mono text-xs">
                        {formatBRL(Number(h.plans?.price ?? 0))}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                Histórico de pagamentos
              </h3>
              {paymentsHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum pagamento registrado</p>
              ) : (
                <ul className="space-y-1.5">
                  {paymentsHistory.map((p: any) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between rounded-md border p-2 text-sm"
                    >
                      <div>
                        <div className="font-medium">
                          {p.reference_month ?? formatDateBR(p.payment_date)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Pago em {formatDateBR(p.payment_date)}
                          {p.due_date && <> · vence {formatDateBR(p.due_date)}</>}
                          {p.payment_method && <> · {p.payment_method}</>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {statusBadge(p.status)}
                        <span className="font-mono text-xs">{formatBRL(Number(p.amount))}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Alterar senha */}
      <Card className="p-6 space-y-3">
        <h2 className="text-sm font-semibold">Alterar senha</h2>
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
