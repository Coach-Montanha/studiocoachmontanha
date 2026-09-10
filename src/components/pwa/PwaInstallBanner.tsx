import { useEffect, useState } from "react";
import { Download, X, Smartphone, Share } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIos, setIsIos] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Verifica se já está rodando em modo standalone (PWA instalado)
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) return;

    // Verifica se o usuário já fechou nesta sessão
    if (sessionStorage.getItem("eduflow_pwa_dismissed")) {
      setDismissed(true);
      return;
    }

    // Detecta iOS Safari
    const ua = window.navigator.userAgent;
    const isIosDevice = /iphone|ipad|ipod/i.test(ua);
    const isSafari = /safari/i.test(ua) && !/chrome|crios|crmo/i.test(ua);
    if (isIosDevice && isSafari) {
      setIsIos(true);
    }

    // Intercepta o evento padrão do Android / Chrome
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setDeferredPrompt(null);
      }
    } else if (isIos) {
      setShowIosGuide(true);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem("eduflow_pwa_dismissed", "true");
  };

  if (dismissed || (!deferredPrompt && !isIos)) return null;

  return (
    <aside aria-label="Instalação do Aplicativo" className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div className="relative flex items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-card/95 p-3.5 shadow-2xl backdrop-blur-md">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
            <Smartphone className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-foreground truncate">
              Instalar App Coach Montanha
            </h4>
            <p className="text-[11px] text-muted-foreground truncate">
              Acesso rápido e direto da tela inicial
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            size="sm"
            onClick={handleInstallClick}
            className="h-8 px-3 text-xs font-semibold shadow-xs"
          >
            <Download className="h-3.5 w-3.5 mr-1" /> Instalar
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

      {/* iOS Safari Guide Tooltip */}
      {showIosGuide && (
        <div className="mt-2 rounded-xl border border-border bg-card p-3 shadow-xl text-xs text-foreground space-y-2">
          <div className="flex items-center justify-between font-bold text-primary">
            <span className="flex items-center gap-1.5">
              <Share className="h-3.5 w-3.5" /> Como instalar no iPhone:
            </span>
            <button
              type="button"
              onClick={() => setShowIosGuide(false)}
              className="text-muted-foreground hover:text-foreground text-xs"
            >
              ✕
            </button>
          </div>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-[11px] leading-relaxed">
            <li>Toque no botão de <strong>Compartilhar</strong> na barra do Safari (ícone de quadrado com seta para cima).</li>
            <li>Role para baixo e selecione <strong>"Adicionar à Tela de Início"</strong>.</li>
            <li>Toque em <strong>"Adicionar"</strong> no canto superior direito.</li>
          </ol>
        </div>
      )}
    </aside>
  );
}
