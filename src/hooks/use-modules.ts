import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRole } from "@/hooks/use-role";

export type AppModule = "studio" | "pt" | "financeiro" | "crm";
export const ALL_MODULES: AppModule[] = ["studio", "pt", "financeiro", "crm"];

/**
 * Retorna quais módulos o usuário atual tem acesso.
 * Super admin tem acesso a todos automaticamente.
 */
export function useModules() {
  const { user, loading: authLoading } = useAuth();
  const { roles, loading: roleLoading } = useRole();
  const isSuperAdmin = roles.includes("super_admin" as never);

  const { data, isLoading } = useQuery({
    queryKey: ["user-modules", user?.id],
    enabled: !!user?.id && !isSuperAdmin,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_modules")
        .select("module, active, expires_at")
        .eq("user_id", user!.id);
      if (error) throw error;
      const now = Date.now();
      const active = (data ?? [])
        .filter(
          (r) =>
            r.active &&
            (r.expires_at === null || new Date(r.expires_at).getTime() > now),
        )
        .map((r) => r.module as AppModule);
      return new Set(active);
    },
  });

  const modules = isSuperAdmin
    ? new Set<AppModule>(ALL_MODULES)
    : (data ?? new Set<AppModule>());
  const hasModule = (m: AppModule) => modules.has(m);
  return {
    modules,
    hasModule,
    isSuperAdmin,
    loading: authLoading || roleLoading || (!isSuperAdmin && isLoading),
  };
}
