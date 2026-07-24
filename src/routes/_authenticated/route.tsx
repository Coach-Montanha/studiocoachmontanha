import { createFileRoute, Outlet, redirect, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/edufinance/AppShell";
import { PortalShell } from "@/components/portal/PortalShell";
import { useRole } from "@/hooks/use-role";
import { usePortalMode } from "@/hooks/use-portal-mode";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // getSession lê do storage local (rápido). Autorização real acontece via RLS/JWT no servidor.
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.user) throw redirect({ to: "/auth" });
    return { user: data.session.user };
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

  if (loading) return null;

  if (isStudent || isPortalPath) {
    return (
      <PortalShell mode={mode ?? "studio"}>
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
