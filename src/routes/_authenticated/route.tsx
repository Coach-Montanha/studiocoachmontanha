import { createFileRoute, Outlet, redirect, useRouterState, useNavigate, isRedirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/edufinance/AppShell";
import { PortalShell } from "@/components/portal/PortalShell";
import { useRole } from "@/hooks/use-role";
import { usePortalMode } from "@/hooks/use-portal-mode";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session?.user) throw redirect({ to: "/auth" });
      return { user: data.session.user };
    } catch (err) {
      if (isRedirect(err)) throw err;
      // Storage corrompido / JSON inválido → volta ao login em vez de travar o match.
      throw redirect({ to: "/auth" });
    }
  },
  component: AuthenticatedLayout,
});


function AuthenticatedLayout() {
  const { isAdmin, isStudent, loading } = useRole();
  const { mode, loading: modeLoading } = usePortalMode();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const isPortalPath = pathname === "/portal" || pathname.startsWith("/portal/");
  const isPTPortalPath = pathname === "/portal/pt" || pathname.startsWith("/portal/pt/");

  useEffect(() => {
    if (loading || modeLoading) return;
    if (isStudent) {
      if (mode === "pt" && !isPTPortalPath) {
        navigate({ to: "/portal/pt", replace: true });
      } else if (mode === "studio" && (isPTPortalPath || !isPortalPath)) {
        navigate({ to: "/portal", replace: true });
      } else if (mode === null && !isPortalPath) {
        navigate({ to: "/portal", replace: true });
      }
    }
    if (isAdmin && isPortalPath) {
      navigate({ to: "/", replace: true });
    }
  }, [loading, modeLoading, isStudent, isAdmin, mode, isPortalPath, isPTPortalPath, navigate]);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-6">
        <div className="flex flex-col items-center gap-3 text-muted-foreground animate-in fade-in duration-200">
          <span
            aria-hidden
            className="h-6 w-6 rounded-full border-2 border-border border-t-primary animate-spin"
          />
          <p className="text-sm leading-relaxed">Carregando seu ambiente…</p>
        </div>
      </div>
    );
  }


  if (isStudent || isPortalPath) {
    return (
      <PortalShell>
        <Outlet />
      </PortalShell>
    );
  }
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
