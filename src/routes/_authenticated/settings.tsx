import { Settings2 as PageIcon } from "lucide-react";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { cn } from "@/lib/utils";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Settings2, ArrowDownUp, Trash2, Sparkles, type LucideIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTransferPanel } from "@/components/settings/DataTransferPanel";
import { TrashPanel } from "@/components/settings/TrashPanel";
import { DragDropPromptCard } from "@/components/pt/DragDropPromptCard";
import { AiEnginePromptCard } from "@/components/pt/AiEnginePromptCard";
import { BusinessLogosPanel } from "@/components/settings/BusinessLogosPanel";

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
import { PaymentMethodsSettings } from "@/components/edufinance/PaymentMethodsSettings";
import { useFontSize, FONT_SIZE_LABEL, FONT_SIZE_PX, type FontSizeKey } from "@/hooks/use-font-size";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLandingOptions, LANDING_STORAGE_KEY, LANDING_REDIRECT_FLAG } from "@/hooks/use-landing-page";
import { useProfileMode } from "@/hooks/use-profile-mode";
import { useRole } from "@/hooks/use-role";
import { Shield, UserCog } from "lucide-react";

const TABS = ["geral", "dados", "prompts", "lixeira"] as const;
type SettingsTab = (typeof TABS)[number];

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Configurações — EduFinance" }] }),
  validateSearch: (search: Record<string, unknown>): { tab?: SettingsTab } => ({
    tab: TABS.includes(search.tab as SettingsTab) ? (search.tab as SettingsTab) : "geral",
  }),
  component: SettingsPage,
});

const TAB_META: Record<SettingsTab, { label: string; icon: LucideIcon; description: string }> = {
  geral: {
    label: "Geral",
    icon: Settings2,
    description: "Preferências da sua conta, aparência e integrações",
  },
  dados: {
    label: "Dados",
    icon: ArrowDownUp,
    description: "Backup, exportações e importação em massa via Excel ou CSV",
  },
  prompts: {
    label: "Prompts",
    icon: Sparkles,
    description: "Configuração de motores de IA e prompts customizados",
  },
  lixeira: {
    label: "Lixeira",
    icon: Trash2,
    description: "Registros excluídos podem ser restaurados. Excluir permanente é irreversível",
  },
};

function SettingsPage() {
  const tab = (Route.useSearch().tab ?? "geral") as SettingsTab;
  const navigate = useNavigate({ from: Route.fullPath });

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <PageHeader
        icon={PageIcon}
        eyebrow="Conta"
        title="Configurações"
        description={TAB_META[tab].description}
      />

      <Tabs
        value={tab}
        onValueChange={(v) => navigate({ search: { tab: v as SettingsTab }, replace: true })}
        className="space-y-8"
      >
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <TabsList className="inline-flex h-auto gap-1 rounded-xl bg-muted/50 p-1">
            {TABS.map((key) => {
              const Icon = TAB_META[key].icon;
              return (
                <TabsTrigger
                  key={key}
                  value={key}
                  className="gap-2 rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-all duration-200 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {TAB_META[key].label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        <TabsContent value="geral" className="mt-0 focus-visible:outline-none">
          <GeneralSettings />
        </TabsContent>
        <TabsContent value="dados" className="mt-0 focus-visible:outline-none">
          {tab === "dados" && <DataTransferPanel />}
        </TabsContent>
        <TabsContent value="prompts" className="mt-0 focus-visible:outline-none">
          {tab === "prompts" && (
            <div className="space-y-6">
              <DragDropPromptCard />
              <AiEnginePromptCard />
            </div>
          )}
        </TabsContent>
        <TabsContent value="lixeira" className="mt-0 focus-visible:outline-none">
          {tab === "lixeira" && <TrashPanel />}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function GeneralSettings() {

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
    <div className="max-w-2xl space-y-6">



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
        <VisualThemeSelector />
        <FontSizeSetting />
        <LandingPageSetting />
      </Card>

      <BusinessLogosPanel />

      <Card className="p-5 space-y-4">
        <h2 className="text-base font-semibold">Perfil</h2>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input value={user?.email ?? ""} disabled />
        </div>
        <ProfileModeSetting />
      </Card>


      <StudioCheckinSettings />

      <PaymentMethodsSettings />

      <Card className="p-5 space-y-2">
        <h2 className="text-base font-semibold">Armazenamento e mídia</h2>
        <p className="text-sm text-muted-foreground">
          Veja e gerencie tudo o que o app guarda para você: imagens de avisos (incluindo as geradas por IA), fotos de alunos, contratos em PDF e mídia de exercícios.
        </p>
        <Button asChild variant="outline" className="w-full sm:w-auto">
          <Link to="/storage">Abrir armazenamento</Link>
        </Button>
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
            <p className="text-xs text-state-paid">✓ Uma API key já está salva no servidor.</p>
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

      <Card className="p-5 space-y-3">
        <div className="flex items-start gap-3">
          <Stethoscope className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div className="flex-1">
            <h2 className="text-base font-semibold">Diagnóstico do sistema</h2>
            <p className="text-sm text-muted-foreground">
              Verifique o estado das integrações, permissões e dados do seu studio. Use para depurar problemas.
            </p>
          </div>
        </div>
        <Button asChild variant="outline">
          <Link to="/diagnostics">Abrir diagnóstico</Link>
        </Button>
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
          checkin_week_start_day: 0,
        }
      );
    },
  });


  const [allowMulti, setAllowMulti] = useState(false);
  const [opens, setOpens] = useState(60);
  const [closes, setCloses] = useState(15);
  const [weekStart, setWeekStart] = useState(0);

  useEffect(() => {
    if (settings) {
      setAllowMulti(!!settings.allow_multi_checkin_same_program_per_day);
      setOpens(settings.default_checkin_opens_minutes_before ?? 60);
      setCloses(settings.default_checkin_closes_minutes_before ?? 15);
      setWeekStart(settings.checkin_week_start_day ?? 0);
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
        checkin_week_start_day: weekStart,
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
      <div className="space-y-1.5">
        <Label>Dia de abertura/resete semanal de check-ins</Label>
        <Select value={String(weekStart)} onValueChange={(v) => setWeekStart(Number(v))}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Selecione o dia" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Domingo</SelectItem>
            <SelectItem value="1">Segunda-feira</SelectItem>
            <SelectItem value="2">Terça-feira</SelectItem>
            <SelectItem value="3">Quarta-feira</SelectItem>
            <SelectItem value="4">Quinta-feira</SelectItem>
            <SelectItem value="5">Sexta-feira</SelectItem>
            <SelectItem value="6">Sábado</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[10px] text-muted-foreground">
          Define quando a contagem semanal de check-ins reinicia e libera a próxima semana.
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        Esses valores servem como sugestão ao criar novas turmas. Cada turma pode ter valores próprios.
      </p>
      <Button onClick={save}>Salvar regras</Button>
    </Card>
  );
}

function FontSizeSetting() {
  const { size, setSize } = useFontSize();
  return (
    <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-sm font-medium">Tamanho da fonte</div>
        <div className="text-xs text-muted-foreground">
          Aumente a fonte se estiver com dificuldade para ler no celular.
        </div>
      </div>
      <Select value={size} onValueChange={(v) => setSize(v as FontSizeKey)}>
        <SelectTrigger className="h-10 w-full sm:w-56"><SelectValue /></SelectTrigger>
        <SelectContent>
          {(["sm","md","lg","xl"] as FontSizeKey[]).map((k) => (
            <SelectItem key={k} value={k}>{FONT_SIZE_LABEL[k]} — {FONT_SIZE_PX[k]}px</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function VisualThemeSelector() {
  const { visualTheme, changeVisualTheme } = useTheme();

  const themes: { id: "padrao" | "pulse"; label: string; primary: string; bg: string }[] = [
    { id: "padrao", label: "Padrão", primary: "#3B82F6", bg: "#F8FAFC" },
    { id: "pulse", label: "Pulse", primary: "#FF6B00", bg: "#0A0A0C" },
  ];

  return (
    <div className="space-y-3 border-t pt-4">
      <div className="text-sm font-medium">Tema Visual</div>
      <div className="grid grid-cols-2 gap-3">
        {themes.map((t) => (
          <button
            key={t.id}
            onClick={() => changeVisualTheme(t.id)}
            className={cn(
              "group relative flex flex-col items-start gap-2 rounded-xl border-2 p-3 text-left transition-all hover:border-primary/40 no-pill",
              visualTheme === t.id ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-card",
            )}
          >
            <div
              className="h-12 w-full rounded-lg overflow-hidden"
              style={{ backgroundColor: t.bg, border: `1px solid ${t.id === "pulse" ? "#232328" : "#E2E8F0"}` }}
            >
              <div className="m-2 h-2 w-8 rounded-full" style={{ backgroundColor: t.primary }} />
            </div>
            <div className="px-1">
              <div className="text-sm font-bold">{t.label}</div>
              {visualTheme === t.id && (
                <div className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                  ✓
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}


function LandingPageSetting() {
  const options = useLandingOptions();
  const [value, setValue] = useState<string>(
    typeof window !== "undefined" ? localStorage.getItem(LANDING_STORAGE_KEY) ?? "/" : "/",
  );
  const safeValue = options.some((o) => o.path === value) ? value : "/";

  function onChange(v: string) {
    setValue(v);
    localStorage.setItem(LANDING_STORAGE_KEY, v);
    // Reset the "already redirected" flag so the next reload honors the new choice.
    sessionStorage.removeItem(LANDING_REDIRECT_FLAG);
    toast.success("Tela inicial atualizada");
  }

  return (
    <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-sm font-medium">Tela inicial</div>
        <div className="text-xs text-muted-foreground">
          O app abrirá nesta tela ao carregar. Você pode navegar livremente depois.
        </div>
      </div>
      <Select value={safeValue} onValueChange={onChange}>
        <SelectTrigger className="h-10 w-full sm:w-64"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.path} value={o.path}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ProfileModeSetting() {
  const { isSuperAdmin, loading } = useRole();
  const { mode, setMode } = useProfileMode();
  const qc = useQueryClient();

  if (loading || !isSuperAdmin) return null;

  return (
    <div className="space-y-1.5 border-t pt-4">
      <Label className="flex items-center gap-2">
        <Shield className="h-4 w-4" /> Modo de acesso
      </Label>
      <p className="text-xs text-muted-foreground">
        Alterne entre visão de super_admin (com escopo entre treinadores) e
        admin (agindo apenas sobre seus próprios dados).
      </p>
      <Select
        value={mode}
        onValueChange={(v) => {
          setMode(v as "super_admin" | "admin");
          qc.invalidateQueries();
        }}
      >
        <SelectTrigger className="w-full max-w-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="super_admin">
            <span className="flex items-center gap-2">
              <Shield className="h-3.5 w-3.5" /> Super admin (edição e suporte)
            </span>
          </SelectItem>
          <SelectItem value="admin">
            <span className="flex items-center gap-2">
              <UserCog className="h-3.5 w-3.5" /> Admin (meu perfil do sistema)
            </span>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
