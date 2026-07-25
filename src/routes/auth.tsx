import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { GraduationCap, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

function safeNext(next: unknown): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" ? s.next : undefined,
  }),
  beforeLoad: async ({ search }) => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ href: safeNext(search.next) });
  },
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const nextPath = safeNext(next);
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [showReset, setShowReset] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Bem-vindo de volta!");
    window.location.href = nextPath;
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}${nextPath}`,
        data: { name },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Conta criada! Verifique seu email se necessário.");
    if ((await supabase.auth.getSession()).data.session) window.location.href = nextPath;
    else navigate({ to: "/auth" });
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setResetError(null);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      setResetError(error.message);
      return;
    }
    setResetSent(true);
  }

  function openReset() {
    setResetSent(false);
    setResetError(null);
    setShowReset(true);
  }

  function backToSignIn() {
    setResetSent(false);
    setResetError(null);
    setShowReset(false);
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      {/* Aurora Mesh — 3 blobs token-based, adapta light/dark automaticamente */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-32 -top-32 h-[520px] w-[520px] rounded-full bg-primary/25 blur-[120px] dark:bg-primary/40" />
        <div className="absolute -bottom-40 -right-32 h-[560px] w-[560px] rounded-full bg-primary/15 blur-[140px] dark:bg-primary/30" />
        <div className="absolute left-1/2 top-1/2 h-[640px] w-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/15 blur-[160px] dark:bg-accent/25" />
        {/* grain sutil pra quebrar o gradiente puro */}
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(color-mix(in oklab, var(--foreground) 5%, transparent) 1px, transparent 1px)",
            backgroundSize: "3px 3px",
          }}
        />
      </div>

      <header className="relative z-10 w-full">
        <div className="mx-auto flex max-w-6xl items-center gap-2.5 px-4 py-4 sm:px-6 sm:py-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary shadow-sm ring-1 ring-primary/20">
            <GraduationCap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-base font-bold tracking-tight text-foreground">EduFinance</span>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-8 sm:py-12">
        <Card
          className="w-full max-w-sm border-border/60 bg-card/85 p-6 shadow-xl shadow-primary/20 ring-1 ring-foreground/5 backdrop-blur-xl sm:max-w-md sm:p-8 dark:shadow-primary/30"
        >
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList className="grid w-full grid-cols-2 bg-muted/60 p-1">
              <TabsTrigger value="signin" className="transition-ui">Entrar</TabsTrigger>
              <TabsTrigger value="signup" className="transition-ui">Criar conta</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-6">
              {showReset ? (
                resetSent ? (
                  <div className="space-y-5 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
                      <CheckCircle2 className="h-7 w-7 text-primary" />
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="text-lg font-semibold leading-tight tracking-tight">Link enviado!</h3>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        Verifique sua caixa de entrada e a pasta de spam.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="block w-full text-center text-sm text-muted-foreground transition-ui hover:text-foreground focus-ring rounded-md"
                      onClick={backToSignIn}
                    >
                      ← Voltar para o login
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleReset} className="space-y-5">
                    <div className="space-y-1.5">
                      <h3 className="text-lg font-semibold leading-tight tracking-tight">Recuperar senha</h3>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        Digite seu e-mail cadastrado e enviaremos um link para criar uma nova senha.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email-r">E-mail</Label>
                      <Input
                        id="email-r"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-10 transition-ui"
                      />
                      {resetError && (
                        <p className="text-sm text-destructive">{resetError}</p>
                      )}
                    </div>
                    <Button
                      type="submit"
                      className="h-10 w-full font-medium transition-ui active:scale-[0.99]"
                      disabled={loading}
                    >
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Enviar link de recuperação
                    </Button>
                    <button
                      type="button"
                      className="block w-full text-center text-sm text-muted-foreground transition-ui hover:text-foreground focus-ring rounded-md"
                      onClick={backToSignIn}
                    >
                      ← Voltar para o login
                    </button>
                  </form>
                )
              ) : (
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-10 transition-ui"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <Input
                      id="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-10 transition-ui"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground transition-ui hover:text-foreground">
                      <Checkbox defaultChecked /> Lembrar de mim
                    </label>
                    <button
                      type="button"
                      className="text-sm text-muted-foreground transition-ui hover:text-foreground focus-ring rounded-md"
                      onClick={openReset}
                    >
                      Esqueci a senha
                    </button>
                  </div>
                  <Button
                    type="submit"
                    className="h-10 w-full font-medium transition-ui active:scale-[0.99]"
                    disabled={loading}
                  >
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Entrar
                  </Button>
                </form>
              )}
            </TabsContent>

            <TabsContent value="signup" className="mt-6">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-10 transition-ui"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email-s">Email</Label>
                  <Input
                    id="email-s"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-10 transition-ui"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pwd-s">Senha</Label>
                  <Input
                    id="pwd-s"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-10 transition-ui"
                  />
                  <p className="text-xs leading-relaxed text-muted-foreground">Mínimo 6 caracteres.</p>
                </div>
                <Button
                  type="submit"
                  className="h-10 w-full font-medium transition-ui active:scale-[0.99]"
                  disabled={loading}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Criar conta
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
      </main>

      <footer className="relative z-10 w-full border-t border-border/40 bg-background/50 backdrop-blur-sm [content-visibility:auto]">
        <div className="mx-auto max-w-6xl px-4 py-4 text-center text-xs font-medium text-muted-foreground sm:px-6 sm:py-6">
          © {new Date().getFullYear()} EduFinance
        </div>
      </footer>
    </div>
  );
}
