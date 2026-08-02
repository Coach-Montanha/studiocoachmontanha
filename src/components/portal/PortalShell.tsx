import { type ReactNode, useState } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  User,
  Calendar,
  LogOut,
  Dumbbell,
  Moon,
  Sun,
  ClipboardList,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useIsFetching, useQueryClient, useQuery } from "@tanstack/react-query";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import { NotificationsBell } from "@/components/portal/NotificationsBell";
import { PortalAnnouncementPopup } from "@/components/portal/PortalAnnouncementPopup";
import { PortalPersistGate, clearPortalCache } from "@/components/portal/PortalPersistGate";

type PortalMode = "studio" | "pt" | "both";

const studioNav = [
  { to: "/portal", label: "Check-ins Studio", icon: Calendar, exact: true },
  { to: "/portal/perfil", label: "Meus dados", icon: User },
];

const ptNav = [
  { to: "/portal/pt", label: "Dados Personal", icon: User, exact: true },
  { to: "/portal/pt/treino", label: "Meu treino", icon: ClipboardList },
];

const bothNav = [
  { to: "/portal", label: "Check-ins Studio", icon: Calendar, exact: true },
  { to: "/portal/pt/treino", label: "Treino Personal", icon: ClipboardList },
  { to: "/portal/perfil", label: "Meus dados", icon: User },
];

const LS_COLLAPSED = "portal:sidebar-collapsed";

export function PortalShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const { data: userTypes, isLoading: loadingTypes } = useQuery({
    queryKey: ["portal-user-types", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const [studio, pt] = await Promise.all([
        supabase.from("students").select("id").eq("account_user_id", user!.id).maybeSingle(),
        supabase.from("pt_students").select("id").eq("account_user_id", user!.id).maybeSingle(),
      ]);
      return { studio: !!studio.data, pt: !!pt.data };
    },
    staleTime: Infinity,
  });

  const mode: PortalMode =
    loadingTypes || !userTypes
      ? "studio"
      : userTypes.studio && userTypes.pt
      ? "both"
      : userTypes.pt
      ? "pt"
      : "studio";

  const nav = mode === "both" ? bothNav : mode === "pt" ? ptNav : studioNav;
  const areaLabel =
    mode === "both" ? "Portal Híbrido" : mode === "pt" ? "Personal Trainer" : "Área do aluno";

  // Init lazy: lê preferência salva (ou breakpoint) já na 1ª render — sem flash de layout.
  const [collapsed, setCollapsedState] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      const saved = localStorage.getItem(LS_COLLAPSED);
      if (saved === "1") return true;
      if (saved === "0") return false;
      return window.matchMedia("(max-width: 767px)").matches;
    } catch {
      return false;
    }
  });

  const setCollapsed = (v: boolean) => {
    setCollapsedState(v);
    try { localStorage.setItem(LS_COLLAPSED, v ? "1" : "0"); } catch { /* ignore */ }
  };

  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { theme, toggleTheme } = useTheme();

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    clearPortalCache(user?.id);
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const isFetching = useIsFetching();

  return (
    <div className="flex min-h-dvh w-full bg-background">
      <PortalPersistGate />
      <aside
        aria-label="Navegação principal"
        className={cn(
          "sticky top-0 z-30 flex h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-out",
          collapsed ? "w-14" : "w-60",
        )}
      >
        <div
          className={cn(
            "flex h-16 items-center gap-2 border-b border-sidebar-border transition-[padding] duration-200",
            collapsed ? "justify-center px-2" : "px-5",
          )}
        >
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary shadow-card ring-1 ring-inset ring-primary-foreground/15">
            <Dumbbell className="h-5 w-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate text-[0.9375rem] font-bold leading-none tracking-tight">Meu Studio</div>
              <div className="text-overline mt-1.5 text-sidebar-foreground/55">{areaLabel}</div>
            </div>
          )}
        </div>

        <nav className={cn("flex-1 space-y-1 overflow-y-auto py-4", collapsed ? "px-2" : "px-3")}>
          {nav.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to, item.exact);
            return (
              <Link
                key={item.to}
                to={item.to}
                preload="intent"
                title={collapsed ? item.label : undefined}
                className={cn(
                  "group relative flex items-center rounded-xl text-sm font-semibold outline-hidden transition-ui focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar active:scale-[0.99]",
                  collapsed ? "h-11 justify-center px-2" : "min-h-11 gap-3 px-3 py-2.5",
                  active
                    ? "bg-primary/12 text-primary"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                )}
              >
                {active && !collapsed && (
                  <span aria-hidden className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
                )}
                <Icon className={cn("h-[1.125rem] w-[1.125rem] shrink-0 transition-ui", active ? "text-primary" : "text-sidebar-foreground/55 group-hover:text-sidebar-foreground")} />
                {!collapsed && <span className="truncate">{item.label}</span>}
                {collapsed && <span className="sr-only">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className={cn("border-t border-sidebar-border", collapsed ? "p-2" : "p-3")}>
          <div
            className={cn(
              "flex items-center gap-2 rounded-lg bg-sidebar-accent transition-[padding] duration-200",
              collapsed ? "justify-center p-2" : "justify-between px-3 py-2",
            )}
          >
            {!collapsed && (
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold">{user?.email ?? "Aluno"}</div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-sidebar-foreground/60">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-state-paid" />
                  Conectado
                </div>
              </div>
            )}
            <button
              onClick={signOut}
              title="Sair"
              aria-label="Sair"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-sidebar-foreground/70 outline-hidden transition-ui hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-border bg-background/85 px-4 backdrop-blur-md md:px-6">
          <button
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
            aria-label={collapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-muted-foreground outline-hidden transition-ui hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-95"
          >
            {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </button>
          <h1 className="min-w-0 truncate text-[0.9375rem] font-bold tracking-tight text-foreground">
            {nav.find((n) => isActive(n.to, n.exact))?.label ?? "Portal"}
          </h1>
          <div className="ml-auto flex items-center gap-1.5">
            <span
              aria-live="polite"
              aria-hidden={isFetching === 0}
              className={cn(
                "hidden items-center gap-1.5 rounded-full border border-border bg-muted/70 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition-opacity duration-200 sm:inline-flex",
                isFetching > 0 ? "opacity-100" : "pointer-events-none opacity-0",
              )}
            >
              <RefreshCw className="h-3 w-3 animate-spin" aria-hidden />
              Atualizando
            </span>
            <NotificationsBell />
            <button
              onClick={toggleTheme}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-muted-foreground outline-hidden transition-ui hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-95 sm:h-10 sm:w-10"
              title={theme === "dark" ? "Modo claro" : "Modo escuro"}
              aria-label="Alternar tema"
            >
              {theme === "dark" ? (
                <Sun className="h-5 w-5 text-state-pending" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-6 lg:p-8">{children}</main>
      </div>
      <PortalAnnouncementPopup />
    </div>
  );
}
