import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { useAuth } from "@/hooks/use-auth";

/**
 * Persistência stale-while-revalidate do cache do portal do aluno.
 *
 * - Escopo: só as queries usadas nas rotas /portal/* (prefixos abaixo).
 * - Storage: localStorage, chave namespaced por usuário — evita vazar
 *   dados entre logins no mesmo device.
 * - Buster: amarrado à versão do build. Deploy novo = cache descartado.
 * - Sem service worker, sem alteração do manifest PWA.
 */

const PORTAL_KEY_PREFIXES = [
  "portal-",
  "perfil-",
  "pt-portal-",
  "agenda",
  "portal-mode",
] as const;

const BUSTER =
  (typeof import.meta !== "undefined" && (import.meta as { env?: { VITE_BUILD_ID?: string } }).env?.VITE_BUILD_ID) ||
  "v1";

export function portalCacheKey(userId: string) {
  return `ef-portal-cache:${userId}`;
}

export function clearPortalCache(userId?: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (userId) {
      window.localStorage.removeItem(portalCacheKey(userId));
      return;
    }
    // Sem userId conhecido: varrer todas as chaves do namespace.
    const toRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith("ef-portal-cache:")) toRemove.push(k);
    }
    toRemove.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* storage bloqueado — comportamento normal segue */
  }
}

export function PortalPersistGate() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    if (!userId || typeof window === "undefined") return;
    let unsubscribe: (() => void) | undefined;
    try {
      const persister = createSyncStoragePersister({
        storage: window.localStorage,
        key: portalCacheKey(userId),
        throttleTime: 1000,
      });

      const [unsub] = persistQueryClient({
        queryClient: qc,
        persister,
        maxAge: 24 * 60 * 60 * 1000,
        buster: BUSTER,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => {
            if (query.state.status !== "success") return false;
            const first = query.queryKey?.[0];
            if (typeof first !== "string") return false;
            return PORTAL_KEY_PREFIXES.some((p) => first === p || first.startsWith(p));
          },
        },
      });
      unsubscribe = unsub;
    } catch {
      /* localStorage cheio ou bloqueado (modo privado): segue sem persistência */
    }
    return () => {
      try {
        unsubscribe?.();
      } catch {
        /* noop */
      }
    };
  }, [qc, userId]);

  return null;
}
