import { useEffect, useState, useCallback } from "react";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * PwaUpdateBanner
 *
 * Detecta silenciosamente quando uma nova versão do app está disponível
 * (novo Service Worker em estado "waiting") e exibe um banner discreto.
 * Ao clicar em "Atualizar", envia SKIP_WAITING ao SW e recarrega a página.
 *
 * Os alunos nunca precisam desinstalar/reinstalar o PWA.
 */
export function PwaUpdateBanner() {
  const [waitingSW, setWaitingSW] = useState<ServiceWorker | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const handleUpdateFound = useCallback((registration: ServiceWorkerRegistration) => {
    const newWorker = registration.installing;
    if (!newWorker) return;

    newWorker.addEventListener("statechange", () => {
      if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
        // Há um SW instalado, mas o antigo ainda está no controle.
        setWaitingSW(newWorker);
        setDismissed(false);
      }
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    let registration: ServiceWorkerRegistration | null = null;
    let pollInterval: ReturnType<typeof setInterval>;

    navigator.serviceWorker.ready.then((reg) => {
      registration = reg;

      // Se já existe um SW esperando (página recarregada enquanto havia update pendente)
      if (reg.waiting && navigator.serviceWorker.controller) {
        setWaitingSW(reg.waiting);
      }

      // Escuta futuros updates
      reg.addEventListener("updatefound", () => handleUpdateFound(reg));

      // Polling a cada 30 minutos para verificar novas versões silenciosamente
      pollInterval = setInterval(() => {
        reg.update().catch(() => {});
      }, 30 * 60 * 1000);
    });

    // Quando o controller muda (novo SW assumiu), recarrega automaticamente
    // — isso acontece após o SKIP_WAITING. Evita reload duplo verificando o flag.
    const handleControllerChange = () => {
      if ((window as any).__pwaReloading) return;
      (window as any).__pwaReloading = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    return () => {
      clearInterval(pollInterval);
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      if (registration) {
        registration.removeEventListener("updatefound", () => handleUpdateFound(registration!));
      }
    };
  }, [handleUpdateFound]);

  const handleUpdate = () => {
    if (!waitingSW) return;
    // Pede ao SW em espera para assumir o controle agora
    waitingSW.postMessage({ type: "SKIP_WAITING" });
    // O reload vai ocorrer via oncontrollerchange
  };

  const handleDismiss = () => {
    setDismissed(true);
    setWaitingSW(null);
  };

  if (!waitingSW || dismissed) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm
        animate-in fade-in slide-in-from-top-3 duration-300"
    >
      <div className="flex items-center gap-3 rounded-2xl border border-primary/40
        bg-primary/10 backdrop-blur-md px-4 py-3 shadow-2xl">
        <RefreshCw className="h-4 w-4 shrink-0 text-primary animate-spin" style={{ animationDuration: "3s" }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground leading-tight">
            Nova versão disponível!
          </p>
          <p className="text-xs text-muted-foreground">
            Toque para atualizar o app agora.
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            size="sm"
            onClick={handleUpdate}
            className="h-8 px-3 text-xs font-semibold"
          >
            Atualizar
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleDismiss}
            className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
            title="Fechar aviso"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
