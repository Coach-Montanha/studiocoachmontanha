import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Eye, EyeOff, CheckCircle2, GraduationCap } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("A senha deve ter no mínimo 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSuccess(true);
    await supabase.auth.signOut();
    setTimeout(() => navigate({ to: "/auth" }), 2000);
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      {/* Aurora Mesh — mesma linguagem da tela de login */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-32 -top-32 h-[520px] w-[520px] rounded-full bg-primary/25 blur-[120px] dark:bg-primary/40" />
        <div className="absolute -bottom-40 -right-32 h-[560px] w-[560px] rounded-full bg-primary/15 blur-[140px] dark:bg-primary/30" />
        <div className="absolute left-1/2 top-1/2 h-[640px] w-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/15 blur-[160px] dark:bg-accent/25" />
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
        <Card className="w-full max-w-sm border-border/60 bg-card/85 p-6 shadow-xl shadow-primary/20 ring-1 ring-foreground/5 backdrop-blur-xl sm:max-w-md sm:p-8 dark:shadow-primary/30">
          {success ? (
            <div className="space-y-5 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-state-paid-soft ring-1 ring-state-paid/20">
                <CheckCircle2 className="h-7 w-7 text-state-paid" />
              </div>
              <div className="space-y-1.5">
                <h1 className="text-section text-foreground">Senha alterada com sucesso!</h1>
                <p className="text-caption text-muted-foreground">Redirecionando para o login…</p>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <h1 className="text-section text-foreground">Criar nova senha</h1>
                <p className="text-caption text-muted-foreground">Defina sua nova senha de acesso.</p>
              </div>

              {!ready && (
                <p className="text-caption mt-4 rounded-lg border border-border bg-surface-sunken px-3 py-2.5 text-muted-foreground">
                  Validando link de recuperação…
                </p>
              )}

              <form onSubmit={submit} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pwd">Nova senha</Label>
                  <div className="relative">
                    <Input
                      id="pwd"
                      type={showPwd ? "text" : "password"}
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      aria-invalid={Boolean(error)}
                      className="h-10 pr-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd((v) => !v)}
                      className="focus-ring absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground transition-ui hover:bg-muted hover:text-foreground"
                      aria-label={showPwd ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-caption text-muted-foreground">Mínimo 8 caracteres.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirmar nova senha</Label>
                  <div className="relative">
                    <Input
                      id="confirm"
                      type={showConfirm ? "text" : "password"}
                      required
                      minLength={8}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      aria-invalid={Boolean(error)}
                      className="h-10 pr-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="focus-ring absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground transition-ui hover:bg-muted hover:text-foreground"
                      aria-label={showConfirm ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <p
                    role="alert"
                    className="text-caption rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-destructive"
                  >
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  className="h-10 w-full font-medium transition-ui active:scale-[0.99]"
                  disabled={loading || !ready}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar nova senha
                </Button>

                <Link
                  to="/auth"
                  className="focus-ring block rounded-md py-1 text-center text-sm text-muted-foreground transition-ui hover:text-foreground"
                >
                  ← Voltar para o login
                </Link>
              </form>
            </>
          )}
        </Card>
      </main>

      <footer className="relative z-10 w-full border-t border-border/40 bg-background/50 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-4 py-4 text-center text-xs font-medium text-muted-foreground sm:px-6 sm:py-6">
          © {new Date().getFullYear()} EduFinance
        </div>
      </footer>
    </div>
  );
}

