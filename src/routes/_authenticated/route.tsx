import { createFileRoute, Outlet, redirect, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/edufinance/AppShell";
import { PortalShell } from "@/components/portal/PortalShell";
import { useRole } from "@/hooks/use-role";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { isAdmin, isStudent, loading } = useRole();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const isPortalPath = pathname === "/portal" || pathname.startsWith("/portal/");

  useEffect(() => {
    if (loading) return;
    if (isStudent && !isPortalPath) {
      navigate({ to: "/portal", replace: true });
    }
    if (isAdmin && isPortalPath) {
      navigate({ to: "/", replace: true });
    }
  }, [loading, isStudent, isAdmin, isPortalPath, navigate]);

  if (loading) return null;

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
