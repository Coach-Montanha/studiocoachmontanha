import { useSyncExternalStore } from "react";

export const IMPERSONATE_STORAGE_KEY = "edufinance.impersonate";

export type ImpersonateMeta = {
  targetEmail: string;
  targetUserId: string;
  superAdminEmail: string;
  startedAt: number;
};

function read(): ImpersonateMeta | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(IMPERSONATE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ImpersonateMeta) : null;
  } catch {
    return null;
  }
}

const listeners = new Set<() => void>();
function emit() {
  for (const l of listeners) l();
}

export function setImpersonate(meta: ImpersonateMeta | null) {
  if (typeof window === "undefined") return;
  if (meta) localStorage.setItem(IMPERSONATE_STORAGE_KEY, JSON.stringify(meta));
  else localStorage.removeItem(IMPERSONATE_STORAGE_KEY);
  emit();
}

export function useImpersonate(): ImpersonateMeta | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      const onStorage = (e: StorageEvent) => {
        if (e.key === IMPERSONATE_STORAGE_KEY) cb();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(cb);
        window.removeEventListener("storage", onStorage);
      };
    },
    read,
    () => null,
  );
}
