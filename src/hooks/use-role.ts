import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type AppRole = "admin" | "student" | "super_admin";

export function useRole() {
  const { user, loading: authLoading } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["user-role", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      const roles = (data ?? []).map((r) => r.role as AppRole);
      return roles;
    },
    staleTime: 60_000,
  });
  const roles = data ?? [];
  const isAdmin = roles.includes("admin");
  const isStudent = roles.includes("student") && !isAdmin;
  return { roles, isAdmin, isStudent, loading: authLoading || isLoading };
}
