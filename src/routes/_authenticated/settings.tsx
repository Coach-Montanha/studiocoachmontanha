import { createFileRoute, Link } from "@tanstack/react-router";
import { Stethoscope } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, Moon, Sun } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getEmailSettings, saveEmailSettings } from "@/lib/email.functions";

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
  const [resendKey, setResendKey] = useState("");
  const [hasSavedResendKey, setHasSavedResendKey] = useState(false);
  const [senderEmail, setSenderEmail] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const loadEmailSettings = useServerFn(getEmailSettings);
  const persistEmailSettings = useServerFn(saveEmailSettings);
  useEffect(() => {
    loadEmailSettings()
      .then((s) => {
        setHasSavedResendKey(s.hasKey);
        setSenderEmail(s.senderEmail ?? "");
      })
      .catch(() => {});
  }, [loadEmailSettings]);
  const [gcalApiKey, setGcalApiKey] = useState(
    typeof window !== "undefined"
      ? localStorage.getItem("edufinance.gcalApiKey") ?? ""
      : "",
  );
  const [gcalId, setGcalId] = useState(
    typeof window !== "undefined"
      ? localStorage.getItem("edufinance.gcalId") ?? "primary"
      : "primary",
  );
  const [gcalClientId, setGcalClientId] = useState(
    typeof window !== "undefined"
      ? localStorage.getItem("edufinance.gcalClientId") ?? ""
      : "",
  );
  const { theme, toggleTheme } = useTheme();

  function saveGcal() {
    localStorage.setItem("edufinance.gcalApiKey", gcalApiKey);
    localStorage.setItem("edufinance.gcalId", gcalId);
    localStorage.setItem("edufinance.gcalClientId", gcalClientId);
    toast.success("Configurações do Google Calendar salvas!");
  }

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

  async function saveResend() {
    setEmailSaving(true);
    try {
      await persistEmailSettings({ data: { resendApiKey: resendKey, senderEmail } });
      // Clear the input after saving so the key is never held in memory longer than needed.
      if (resendKey.trim().length > 0) {
        setHasSavedResendKey(true);
        setResendKey("");
      }
      toast.success("Configurações de email salvas!");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setEmailSaving(false);
    }
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
        <h2 className="text-base font-semibold">Aparência</h2>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium">Tema</div>
            <div className="text-xs text-muted-foreground">
              {theme === "dark" ? "Modo escuro ativado" : "Modo claro ativado"}
            </div>
          </div>
          <Button variant="outline" onClick={toggleTheme}>
            {theme === "dark" ? (
              <>
                <Sun className="mr-2 h-4 w-4" /> Modo claro
              </>
            ) : (
              <>
                <Moon className="mr-2 h-4 w-4" /> Modo escuro
              </>
            )}
          </Button>
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <h2 className="text-base font-semibold">Perfil</h2>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input value={user?.email ?? ""} disabled />
        </div>
      </Card>

      <StudioCheckinSettings />


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
          . A chave fica guardada com segurança no servidor e nunca é enviada ao navegador.
        </p>
        <div className="space-y-1.5">
          <Label>API Key do Resend</Label>
          <Input
            type="password"
            value={resendKey}
            onChange={(e) => setResendKey(e.target.value)}
            placeholder={hasSavedResendKey ? "•••••••• (chave salva — preencha só para trocar)" : "re_xxxxxxxxxxxxxxxxxxxx"}
            autoComplete="off"
          />
          {hasSavedResendKey && (
            <p className="text-xs text-emerald-600">✓ Uma API key já está salva no servidor.</p>
          )}
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
        <Button onClick={saveResend} disabled={emailSaving}>
          {emailSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar configurações de email
        </Button>
      </Card>

      <Card className="p-5 space-y-4">
        <h2 className="text-base font-semibold">Google Calendar</h2>
        <p className="text-sm text-muted-foreground">
          Sincronize aulas PT com seu Google Calendar. Você precisará de um{" "}
          <a
            href="https://console.cloud.google.com/apis/credentials"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            Client ID OAuth2
          </a>{" "}
          do Google Cloud Console com a API Calendar habilitada.
        </p>
        <div className="space-y-1.5">
          <Label>Google OAuth2 Client ID</Label>
          <Input
            value={gcalClientId}
            onChange={(e) => setGcalClientId(e.target.value)}
            placeholder="xxxx.apps.googleusercontent.com"
          />
        </div>
        <div className="space-y-1.5">
          <Label>API Key (opcional)</Label>
          <Input
            type="password"
            value={gcalApiKey}
            onChange={(e) => setGcalApiKey(e.target.value)}
            placeholder="AIza..."
          />
        </div>
        <div className="space-y-1.5">
          <Label>ID do Calendário</Label>
          <Input
            value={gcalId}
            onChange={(e) => setGcalId(e.target.value)}
            placeholder="primary (ou email@gmail.com)"
          />
          <p className="text-xs text-muted-foreground">
            Use "primary" para o calendário principal da sua conta Google.
          </p>
        </div>
        <Button onClick={saveGcal}>Salvar configurações do Calendar</Button>
      </Card>
    </div>
  );
}

function StudioCheckinSettings() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ["studio-settings", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("studio_settings")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return (
        data ?? {
          allow_multi_checkin_same_program_per_day: false,
          default_checkin_opens_minutes_before: 60,
          default_checkin_closes_minutes_before: 15,
        }
      );
    },
  });

  const [allowMulti, setAllowMulti] = useState(false);
  const [opens, setOpens] = useState(60);
  const [closes, setCloses] = useState(15);

  useEffect(() => {
    if (settings) {
      setAllowMulti(!!settings.allow_multi_checkin_same_program_per_day);
      setOpens(settings.default_checkin_opens_minutes_before ?? 60);
      setCloses(settings.default_checkin_closes_minutes_before ?? 15);
    }
  }, [settings]);

  async function save() {
    if (!user) return;
    const { error } = await supabase.from("studio_settings").upsert(
      {
        user_id: user.id,
        allow_multi_checkin_same_program_per_day: allowMulti,
        default_checkin_opens_minutes_before: opens,
        default_checkin_closes_minutes_before: closes,
      },
      { onConflict: "user_id" },
    );
    if (error) return toast.error(error.message);
    toast.success("Regras de check-in salvas");
    qc.invalidateQueries({ queryKey: ["studio-settings"] });
  }

  if (isLoading) return null;

  return (
    <Card className="p-5 space-y-4">
      <div>
        <h2 className="text-base font-semibold">Regras de check-in</h2>
        <p className="text-xs text-muted-foreground">
          Estas regras se aplicam ao check-in dos alunos nas turmas do studio.
        </p>
      </div>
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={allowMulti}
          onChange={(e) => setAllowMulti(e.target.checked)}
        />
        <div>
          <div className="font-medium">Permitir múltiplos check-ins por dia no mesmo programa</div>
          <div className="text-xs text-muted-foreground">
            Quando desligado, o aluno só pode fazer 1 check-in por dia dentro de cada programa (ex: 1x Muay Thai, 1x Funcional).
          </div>
        </div>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Padrão: abre X min antes</Label>
          <Input type="number" min={0} value={opens} onChange={(e) => setOpens(Number(e.target.value))} />
        </div>
        <div className="space-y-1.5">
          <Label>Padrão: fecha X min antes</Label>
          <Input type="number" min={0} value={closes} onChange={(e) => setCloses(Number(e.target.value))} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Esses valores servem como sugestão ao criar novas turmas. Cada turma pode ter valores próprios.
      </p>
      <Button onClick={save}>Salvar regras</Button>
    </Card>
  );
}
