import { type ReactNode, useEffect, useState } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  User,
  Calendar,
  LogOut,
  Menu,
  X,
  Dumbbell,
  Moon,
  Sun,
  ClipboardList,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import { NotificationsBell } from "@/components/portal/NotificationsBell";
import { PortalAnnouncementPopup } from "@/components/portal/PortalAnnouncementPopup";

type PortalMode = "studio" | "pt";

const studioNav = [
  { to: "/portal", label: "Agendamento de check-ins", icon: Calendar, exact: true },
  { to: "/portal/perfil", label: "Meus dados", icon: User },
];

const ptNav = [
  { to: "/portal/pt", label: "Minhas informações", icon: User, exact: true },
  { to: "/portal/pt/treino", label: "Meu treino", icon: ClipboardList },
];

export function PortalShell({ children, mode = "studio" }: { children: ReactNode; mode?: PortalMode }) {
  const nav = mode === "pt" ? ptNav : studioNav;
  const areaLabel = mode === "pt" ? "Personal Trainer" : "Área do aluno";
  const [open, setOpen] = useState(false);
  // No mobile a barra lateral começa aberta; o botão hamburger recolhe.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(max-width: 767px)").matches) {
      setOpen(true);
    }
  }, []);
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
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-sidebar text-sidebar-foreground transition-transform md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Dumbbell className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <div className="text-base font-bold leading-none">Meu Studio</div>
            <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60">
              {areaLabel}
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to, item.exact);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center justify-between gap-2 rounded-lg bg-sidebar-accent px-3 py-2">
            <div className="min-w-0">
              <div className="truncate text-xs font-medium">{user?.email ?? "Aluno"}</div>
              <div className="text-[10px] text-sidebar-foreground/60">Conectado</div>
            </div>
            <button
              onClick={signOut}
              title="Sair"
              className="rounded-md p-1.5 text-sidebar-foreground/70 hover:bg-sidebar/40 hover:text-sidebar-foreground"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="flex min-h-screen flex-1 flex-col md:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur md:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <h1 className="text-sm font-semibold text-muted-foreground">
            {nav.find((n) => isActive(n.to, n.exact))?.label ?? "Portal"}
          </h1>
          <div className="ml-auto flex items-center gap-1">
            <NotificationsBell />
            <button
              onClick={toggleTheme}
              className="flex h-11 w-11 items-center justify-center rounded-md hover:bg-accent transition-colors sm:h-9 sm:w-9"
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
