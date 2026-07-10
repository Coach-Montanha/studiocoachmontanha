import { useSyncExternalStore, useCallback } from "react";

/**
 * Tenant scope selector for super_admin users.
 * - "own"  → only the current user's rows (default; hides other trainers)
 * - "all"  → all tenants (raw super_admin visibility)
 * - <uuid> → a specific trainer's tenant
 *
 * Non–super_admin users always resolve to "own" — RLS still enforces that
 * they see only their own data regardless of this value.
 */
export const TENANT_SCOPE_KEY = "edufinance.tenantScope";
export type TenantScope = "own" | "all" | string;

function subscribe(cb: () => void) {
  const handler = (e: StorageEvent) => {
    if (e.key === TENANT_SCOPE_KEY) cb();
  };
  window.addEventListener("storage", handler);
  window.addEventListener("edufinance:tenantScope", cb as EventListener);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener("edufinance:tenantScope", cb as EventListener);
  };
}

function getSnapshot(): TenantScope {
  if (typeof window === "undefined") return "own";
  return (localStorage.getItem(TENANT_SCOPE_KEY) as TenantScope) || "own";
}

export function useTenantScope() {
  const scope = useSyncExternalStore(subscribe, getSnapshot, () => "own");
  const setScope = useCallback((next: TenantScope) => {
    if (typeof window === "undefined") return;
    if (next === "own") localStorage.removeItem(TENANT_SCOPE_KEY);
    else localStorage.setItem(TENANT_SCOPE_KEY, next);
    window.dispatchEvent(new Event("edufinance:tenantScope"));
  }, []);
  return { scope, setScope };
}
