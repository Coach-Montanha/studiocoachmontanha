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
} from "lucide-react";
import { RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import { NotificationsBell } from "@/components/portal/NotificationsBell";
import { PortalAnnouncementPopup } from "@/components/portal/PortalAnnouncementPopup";
import { PortalPersistGate, clearPortalCache } from "@/components/portal/PortalPersistGate";

type PortalMode = "studio" | "pt";

const studioNav = [
  { to: "/portal", label: "Agendamento de check-ins", icon: Calendar, exact: true },
  { to: "/portal/perfil", label: "Meus dados", icon: User },
];

const ptNav = [
  { to: "/portal/pt", label: "Minhas informações", icon: User, exact: true },
  { to: "/portal/pt/treino", label: "Meu treino", icon: ClipboardList },
];

const LS_COLLAPSED = "portal:sidebar-collapsed";

export function PortalShell({ children, mode = "studio" }: { children: ReactNode; mode?: PortalMode }) {
  const nav = mode === "pt" ? ptNav : studioNav;
  const areaLabel = mode === "pt" ? "Personal Trainer" : "Área do aluno";

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
  const { user } = useAuth();
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
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary">
            <Dumbbell className="h-5 w-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate text-base font-bold leading-none">Meu Studio</div>
              <div className="mt-1 text-[10px] uppercase tracking-wider text-sidebar-foreground/60">
                {areaLabel}
              </div>
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
                  "group flex items-center rounded-lg text-sm font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
                  collapsed ? "justify-center px-2 py-2" : "gap-3 px-3 py-2",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
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
                <div className="truncate text-xs font-medium">{user?.email ?? "Aluno"}</div>
                <div className="text-[10px] text-sidebar-foreground/60">Conectado</div>
              </div>
            )}
            <button
              onClick={signOut}
              title="Sair"
              aria-label="Sair"
              className="rounded-md p-1.5 text-sidebar-foreground/70 outline-none transition-colors duration-150 hover:bg-sidebar/40 hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur md:px-6">
          <button
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
            aria-label={collapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
            className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors duration-150 hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </button>
          <h1 className="min-w-0 truncate text-sm font-semibold text-muted-foreground">
            {nav.find((n) => isActive(n.to, n.exact))?.label ?? "Portal"}
          </h1>
          <div className="ml-auto flex items-center gap-1">
            <NotificationsBell />
            <button
              onClick={toggleTheme}
              className="flex h-11 w-11 items-center justify-center rounded-md outline-none transition-colors duration-150 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:h-9 sm:w-9"
              title={theme === "dark" ? "Modo claro" : "Modo escuro"}
              aria-label="Alternar tema"
            >
              {theme === "dark" ? (
                <Sun className="h-5 w-5 text-amber-400" />
              ) : (
                <Moon className="h-5 w-5 text-muted-foreground" />
              )}
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
      <PortalAnnouncementPopup />
    </div>
  );
}
