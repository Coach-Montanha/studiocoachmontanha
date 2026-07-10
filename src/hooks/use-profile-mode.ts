import { useSyncExternalStore, useCallback } from "react";

/**
 * Profile mode for super_admin users.
 * - "super_admin" → full super admin: cross-tenant scope selector, admin nav, etc.
 * - "admin"       → act as a regular admin scoped to own data (support/edit
 *                   without accidentally touching other tenants).
 *
 * For users who are NOT super_admin this hook always resolves to "admin"
 * (RLS already prevents cross-tenant access).
 */
export const PROFILE_MODE_KEY = "edufinance.profileMode";
export type ProfileMode = "super_admin" | "admin";

function subscribe(cb: () => void) {
  const h = (e: StorageEvent) => {
    if (e.key === PROFILE_MODE_KEY) cb();
  };
  window.addEventListener("storage", h);
  window.addEventListener("edufinance:profileMode", cb as EventListener);
  return () => {
    window.removeEventListener("storage", h);
    window.removeEventListener("edufinance:profileMode", cb as EventListener);
  };
}

function getSnapshot(): ProfileMode {
  if (typeof window === "undefined") return "super_admin";
  return (localStorage.getItem(PROFILE_MODE_KEY) as ProfileMode) || "super_admin";
}

export function useProfileMode() {
  const mode = useSyncExternalStore(subscribe, getSnapshot, () => "super_admin");
  const setMode = useCallback((next: ProfileMode) => {
    if (typeof window === "undefined") return;
    if (next === "super_admin") localStorage.removeItem(PROFILE_MODE_KEY);
    else localStorage.setItem(PROFILE_MODE_KEY, next);
    window.dispatchEvent(new Event("edufinance:profileMode"));
  }, []);
  return { mode, setMode };
}
