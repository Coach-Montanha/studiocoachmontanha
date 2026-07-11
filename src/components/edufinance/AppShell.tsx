import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  TrendingUp,
  ClipboardList,
  ArrowDownUp,
  Settings,
  LogOut,
  GraduationCap,
  Dumbbell,
  Menu,
  X,
  Megaphone,
  Zap,
  Moon,
  Sun,
  Wallet,
  Calendar,
  Trash2,
} from "lucide-react";



import { useTheme } from "@/hooks/use-theme";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useModules, type AppModule } from "@/hooks/use-modules";
import { useImpersonate, setImpersonate } from "@/hooks/use-impersonate";
import { TenantScopeSelector } from "@/components/edufinance/TenantScopeSelector";
import { useProfileMode } from "@/hooks/use-profile-mode";
import { useTenantScope } from "@/hooks/use-tenant-scope";
import { useScopeFilter } from "@/hooks/use-scope-filter";
import { listTenants } from "@/lib/tenants.functions";
import { Shield, Eye, UserCircle2 } from "lucide-react";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  section?: string;
  module?: AppModule;
};
const nav: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },

  { to: "/students", label: "Alunos", icon: Users, section: "Studio", module: "studio" },
  { to: "/payments", label: "Pagamentos", icon: CreditCard, section: "Studio", module: "studio" },
  { to: "/plans", label: "Planos", icon: ClipboardList, section: "Studio", module: "studio" },
  { to: "/analytics", label: "Análises", icon: TrendingUp, section: "Studio", module: "studio" },

  { to: "/agenda", label: "Turmas & Agenda", icon: Calendar, section: "Aulas", module: "studio" },
  { to: "/programs", label: "Programas", icon: ClipboardList, section: "Aulas", module: "studio" },

  { to: "/personal-trainer", label: "Personal Trainer", icon: Dumbbell, exact: true, section: "Personal Trainer", module: "pt" },
  { to: "/personal-trainer/checkin", label: "⚡ Check-in Rápido", icon: Zap, section: "Personal Trainer", module: "pt" },

  { to: "/financeiro", label: "Financeiro", icon: Wallet, section: "Gestão", module: "financeiro" },
  { to: "/crm", label: "CRM", icon: Megaphone, section: "Gestão", module: "crm" },
  { to: "/import-export", label: "Importar / Exportar", icon: ArrowDownUp, section: "Gestão" },
  { to: "/trash", label: "Lixeira", icon: Trash2, section: "Gestão" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { theme, toggleTheme } = useTheme();
  const { hasModule, isSuperAdmin: isSuperAdminReal, loading: modulesLoading } = useModules();
  const { mode: profileMode } = useProfileMode();
  const isSuperAdmin = isSuperAdminReal && profileMode === "super_admin";
  const { scope } = useTenantScope();
  const { scopeId } = useScopeFilter();
  const viewingOtherTenant = isSuperAdmin && scope !== "own" && scopeId !== user?.id;
  const impersonate = useImpersonate();

  const fetchTenants = useServerFn(listTenants);
  const { data: tenantsList = [] } = useQuery({
    queryKey: ["tenants-list-scope"],
    queryFn: () => fetchTenants(),
    staleTime: 60_000,
    enabled: isSuperAdminReal,
  });
  const activeProfileLabel = (() => {
    if (!isSuperAdmin) return null;
    if (scope === "all") return "Todos os treinadores";
    if (scope === "own" || scopeId === user?.id) return null;
    const t = tenantsList.find((x) => x.userId === scope);
    return t?.email ?? "Treinador";
  })();

  const visibleNav = nav.filter((it) => !it.module || hasModule(it.module));

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  // Guard: block direct URL access to a module the user doesn't have.
  useEffect(() => {
    if (modulesLoading) return;
    const match = nav.find((n) => n.module && isActive(n.to, n.exact));
    if (match && match.module && !hasModule(match.module)) {
      navigate({ to: "/", replace: true });
    }
  }, [pathname, modulesLoading, hasModule, navigate]);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  async function stopImpersonate() {
    setImpersonate(null);
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-sidebar text-sidebar-foreground transition-transform md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <GraduationCap className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <div className="text-base font-bold leading-none">EduFinance</div>
            <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60">
              Gestão financeira
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {(() => {
            let lastSection: string | undefined;
            return visibleNav.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.to, item.exact);
              const showHeader = item.section && item.section !== lastSection;
              lastSection = item.section;
              return (
                <div key={item.to}>
                  {showHeader && (
                    <div className="mt-3 mb-1 px-3 text-[10px] uppercase tracking-wider text-sidebar-foreground/50">
                      {item.section}
                    </div>
                  )}
                  <Link
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
                </div>
              );
            });
          })()}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          {isSuperAdmin && <TenantScopeSelector />}
          {isSuperAdmin && (
            <Link
              to="/admin/tenants"
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                pathname.startsWith("/admin")
                  ? "bg-primary text-primary-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent",
              )}
            >
              <Shield className="h-4 w-4" />
              Treinadores
            </Link>
          )}
          <Link
            to="/settings"
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              pathname === "/settings"
                ? "bg-primary text-primary-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent",
            )}
          >
            <Settings className="h-4 w-4" />
            Configurações
          </Link>
          <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-sidebar-accent px-3 py-2">
            <div className="min-w-0">
              <div className="truncate text-xs font-medium">{user?.email ?? "Usuário"}</div>
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

      {/* Main */}
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
            {nav.find((n) => isActive(n.to, n.exact))?.label ??
              (pathname === "/settings" ? "Configurações" : "EduFinance")}
          </h1>
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={toggleTheme}
              className="flex h-11 w-11 items-center justify-center rounded-md hover:bg-accent transition-colors sm:h-9 sm:w-9"
              title={theme === "dark" ? "Mudar para modo claro" : "Mudar para modo escuro"}
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
        {impersonate && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/40 bg-amber-500/15 px-4 py-2 text-xs text-amber-900 dark:text-amber-200 md:px-6">
            <div>
              <span className="font-semibold">Modo suporte:</span> você está visualizando como{" "}
              <span className="font-mono">{impersonate.targetEmail}</span>. Seus dados de super admin não são visíveis nesta sessão.
            </div>
            <Button size="sm" variant="outline" onClick={stopImpersonate}>
              <LogOut className="mr-1 h-3 w-3" /> Sair do modo suporte
            </Button>
          </div>
        )}
        {viewingOtherTenant && (
          <div className="flex flex-wrap items-center gap-2 border-b border-blue-500/40 bg-blue-500/10 px-4 py-2 text-xs text-blue-900 dark:text-blue-200 md:px-6">
            <Eye className="h-3.5 w-3.5" />
            <span className="font-semibold">Escopo alterado:</span> você está visualizando dados de outro treinador (
            <span className="font-mono">{scope === "all" ? "TODOS" : scope.slice(0, 8) + "…"}</span>). Exclusões estão bloqueadas nesta visão — mude o escopo para "Meus dados" para excluir seus próprios registros.
          </div>
        )}
        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
