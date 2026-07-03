import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Configurações — EduFinance" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const [academyName, setAcademyName] = useState(
    typeof window !== "undefined" ? localStorage.getItem("edufinance.academy") ?? "" : "",
  );
  const [fiscalMonth, setFiscalMonth] = useState(
    typeof window !== "undefined" ? localStorage.getItem("edufinance.fiscalMonth") ?? "1" : "1",
  );
  const [resendKey, setResendKey] = useState(
    typeof window !== "undefined" ? localStorage.getItem("edufinance.resendKey") ?? "" : "",
  );
  const [senderEmail, setSenderEmail] = useState(
    typeof window !== "undefined" ? localStorage.getItem("edufinance.senderEmail") ?? "" : "",
  );

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  function save() {
    localStorage.setItem("edufinance.academy", academyName);
    localStorage.setItem("edufinance.fiscalMonth", fiscalMonth);
  }

  function saveResend() {
    localStorage.setItem("edufinance.resendKey", resendKey);
    localStorage.setItem("edufinance.senderEmail", senderEmail);
    toast.success("Configurações de email salvas!");
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    if (newPassword.length < 8) {
      setPwError("A nova senha deve ter no mínimo 8 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("As senhas não coincidem.");
      return;
    }
    setPwLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user?.email ?? "",
      password: currentPassword,
    });
    if (signInError) {
      setPwLoading(false);
      setPwError("Senha atual incorreta.");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPwLoading(false);
    if (error) {
      setPwError(error.message);
      return;
    }
    toast.success("Senha alterada com sucesso!");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">Preferências da sua conta</p>
      </div>

      <Card className="p-5 space-y-4">
        <h2 className="text-base font-semibold">Perfil</h2>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input value={user?.email ?? ""} disabled />
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <h2 className="text-base font-semibold">Negócio</h2>
        <div className="space-y-1.5">
          <Label>Nome da escola / academia</Label>
          <Input value={academyName} onChange={(e) => setAcademyName(e.target.value)} placeholder="Minha Escola" />
        </div>
        <div className="space-y-1.5">
          <Label>Moeda padrão</Label>
          <Input value="BRL — Real brasileiro" disabled />
        </div>
        <div className="space-y-1.5">
          <Label>Mês inicial do ano fiscal</Label>
          <Input type="number" min={1} max={12} value={fiscalMonth} onChange={(e) => setFiscalMonth(e.target.value)} />
        </div>
        <Button onClick={save}>Salvar</Button>
      </Card>

      <Card className="p-5 space-y-4">
        <h2 className="text-base font-semibold">Alterar senha</h2>
        <form className="space-y-4" onSubmit={handleChangePassword}>
          <div className="space-y-1.5">
            <Label>Senha atual</Label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Nova senha</Label>
            <div className="relative">
              <Input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                className="pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showNew ? "Ocultar senha" : "Mostrar senha"}
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Mínimo 8 caracteres.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Confirmar nova senha</Label>
            <div className="relative">
              <Input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                className="pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showConfirm ? "Ocultar senha" : "Mostrar senha"}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          {pwError && <p className="text-sm text-destructive">{pwError}</p>}
          <Button type="submit" disabled={pwLoading}>
            {pwLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            Alterar senha
          </Button>
        </form>
      </Card>

      <Card className="p-5 space-y-4">
        <h2 className="text-base font-semibold">Integração de Email (Resend)</h2>
        <p className="text-sm text-muted-foreground">
          Para enviar emails pelo CRM, configure sua API key do{" "}
          <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">
            Resend
          </a>
          . A chave fica salva apenas no seu navegador.
        </p>
        <div className="space-y-1.5">
          <Label>API Key do Resend</Label>
          <Input
            type="password"
            value={resendKey}
            onChange={(e) => setResendKey(e.target.value)}
            placeholder="re_xxxxxxxxxxxxxxxxxxxx"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Email remetente</Label>
          <Input
            type="email"
            value={senderEmail}
            onChange={(e) => setSenderEmail(e.target.value)}
            placeholder="noreply@seudominio.com"
          />
          <p className="text-xs text-muted-foreground">
            Deve ser um domínio verificado no Resend. Para testes, use onboarding@resend.dev
          </p>
        </div>
        <Button onClick={saveResend}>Salvar configurações de email</Button>
      </Card>
    </div>
  );
}
