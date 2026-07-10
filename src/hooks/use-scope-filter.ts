import { useAuth } from "@/hooks/use-auth";
import { useRole } from "@/hooks/use-role";
import { useProfileMode } from "@/hooks/use-profile-mode";
import { useTenantScope } from "@/hooks/use-tenant-scope";

/**
 * Resolves which tenant's data queries should filter by.
 *
 * Returns:
 *  - `scopeId`  → uuid to filter `user_id` by, or `null` for no filter
 *                 (only super_admin in "super_admin" mode with scope="all"
 *                 sees everything).
 *  - `scopeKey` → stable string for query keys (safe when scopeId is null).
 *  - `ready`    → false while auth is still loading.
 *
 * Non–super_admin users always get their own uuid, regardless of the stored
 * scope selection. Super_admin acting in "admin" profile mode is also forced
 * to their own uuid.
 */
export function useScopeFilter() {
  const { user, loading: authLoading } = useAuth();
  const { isSuperAdmin, loading: roleLoading } = useRole();
  const { mode } = useProfileMode();
  const { scope } = useTenantScope();

  const effectivelySuperAdmin = isSuperAdmin && mode === "super_admin";

  let scopeId: string | null = user?.id ?? null;
  if (effectivelySuperAdmin) {
    if (scope === "all") scopeId = null;
    else if (scope === "own") scopeId = user?.id ?? null;
    else scopeId = scope; // specific tenant uuid
  }

  return {
    scopeId,
    scopeKey: scopeId ?? "all",
    ready: !authLoading && !roleLoading,
    effectivelySuperAdmin,
  };
}
