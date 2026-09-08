import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Timer, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function formatSeconds(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function playBeep() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const beep = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + start + 0.02);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + start + dur);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur);
    };
    beep(880, 0, 0.35);
    beep(1175, 0.4, 0.35);
    beep(880, 0.8, 0.45);
    setTimeout(() => ctx.close(), 1500);
  } catch {
    // ignore
  }
}

export function SessionTimer({
  seconds = 0,
  setSeconds,
  running = false,
  setRunning,
  onReset,
  variant = "hero",
  className,
}: {
  seconds?: number;
  setSeconds?: (val: number) => void;
  running?: boolean;
  setRunning?: (val: boolean) => void;
  onReset?: () => void;
  variant?: "hero" | "compact";
  className?: string;
}) {
  const [internalSeconds, setInternalSeconds] = useState(0);
  const [internalRunning, setInternalRunning] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const currentSeconds = setSeconds ? seconds : internalSeconds;
  const currentRunning = setRunning ? running : internalRunning;

  const setCurrentSeconds = setSeconds || setInternalSeconds;
  const setCurrentRunning = setRunning || setInternalRunning;

  const lastAlertRef = useRef(0);

  useEffect(() => {
    if (!currentRunning) return;
    const startedAt = Date.now() - currentSeconds * 1000;
    const id = window.setInterval(() => {
      const next = Math.floor((Date.now() - startedAt) / 1000);
      setCurrentSeconds(next);
      const hoursDone = Math.floor(next / 3600);
      if (hoursDone > lastAlertRef.current && next > 0) {
        lastAlertRef.current = hoursDone;
        playBeep();
        toast.info(`Sessão em andamento: ${hoursDone}h completada`);
      }
    }, 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRunning]);

  function reset() {
    setCurrentRunning(false);
    setCurrentSeconds(0);
    lastAlertRef.current = 0;
    onReset?.();
  }

  if (variant === "compact") {
    return (
      <div className={cn("flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-3 shadow-xs", className)}>
        <div className="flex items-center gap-2 min-w-0">
          <Timer className={cn("h-4 w-4 shrink-0", currentRunning ? "text-emerald-500 animate-pulse" : "text-primary")} />
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Cronômetro
            </div>
            <div className="font-mono text-xl font-extrabold tabular-nums text-foreground">
              {formatSeconds(currentSeconds)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            size="sm"
            variant={currentRunning ? "secondary" : "default"}
            onClick={() => setCurrentRunning(!currentRunning)}
            className="h-8 gap-1 px-2.5 text-xs font-semibold"
          >
            {currentRunning ? (
              <>
                <Pause className="h-3.5 w-3.5" /> Pausar
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" /> {currentSeconds === 0 ? "Iniciar" : "Retomar"}
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={reset}
            disabled={currentSeconds === 0 && !currentRunning}
            className="h-8 px-2 text-xs"
            title="Zerar"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  if (variant === "compact" || isCollapsed) {
    return (
      <div
        className={cn(
          "relative flex items-center justify-between gap-2.5 rounded-2xl border border-border/80 bg-card/95 p-2.5 sm:p-3 shadow-xs backdrop-blur-md transition-all duration-200 min-w-0 max-w-full overflow-hidden",
          currentRunning && "border-emerald-500/30 ring-1 ring-emerald-500/20",
          className,
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute inset-x-0 top-0 h-1 transition-all duration-300",
            currentRunning
              ? "bg-gradient-to-r from-emerald-500 via-primary to-emerald-400"
              : currentSeconds > 0
              ? "bg-amber-500/70"
              : "bg-muted",
          )}
        />
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={cn(
              "h-2.5 w-2.5 rounded-full shrink-0",
              currentRunning
                ? "bg-emerald-500 animate-ping"
                : currentSeconds > 0
                ? "bg-amber-500"
                : "bg-muted-foreground/60",
            )}
          />
          <div className="font-mono text-2xl sm:text-3xl font-black tabular-nums tracking-tight text-foreground leading-none">
            {formatSeconds(currentSeconds)}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            type="button"
            size="sm"
            className={cn(
              "h-9 px-3 rounded-xl text-xs font-bold transition-all active:scale-95",
              currentRunning
                ? "bg-amber-500 text-white hover:bg-amber-600"
                : currentSeconds > 0
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                : "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
            onClick={() => setCurrentRunning(!currentRunning)}
          >
            {currentRunning ? (
              <>
                <Pause className="h-3.5 w-3.5 mr-1" /> Pausar
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 mr-1" /> {currentSeconds === 0 ? "Iniciar" : "Retomar"}
              </>
            )}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={reset}
            disabled={currentSeconds === 0 && !currentRunning}
            className="h-9 w-9 p-0 rounded-xl border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground"
            title="Zerar cronômetro"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          {variant !== "compact" && (
            <button
              type="button"
              onClick={() => setIsCollapsed(false)}
              className="h-9 w-9 grid place-items-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
              title="Expandir cronômetro gigante"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Hero variant: Grande, centralizado, legível à distância durante o treino (+100% a +150% maior)
  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-border/80 bg-card/95 p-3.5 sm:p-5 shadow-sm backdrop-blur-md transition-all duration-200 min-w-0 max-w-full overflow-hidden",
        currentRunning && "border-emerald-500/30 ring-1 ring-emerald-500/20",
        className,
      )}
    >
      {/* Indicador de linha decorativa no topo */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-x-0 top-0 h-1 transition-all duration-300",
          currentRunning
            ? "bg-gradient-to-r from-emerald-500 via-primary to-emerald-400"
            : currentSeconds > 0
            ? "bg-amber-500/70"
            : "bg-muted",
        )}
      />

      {/* Barra superior de status com botão de recolher */}
      <div className="flex w-full items-center justify-between min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <Timer
            className={cn(
              "h-4 w-4 shrink-0 transition-colors",
              currentRunning ? "text-emerald-500 animate-pulse" : "text-muted-foreground",
            )}
          />
          <span className="truncate text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Cronômetro do treino
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wide uppercase transition-all duration-200",
              currentRunning
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : currentSeconds > 0
                ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : "border-border bg-muted/60 text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                currentRunning
                  ? "bg-emerald-500 animate-ping"
                  : currentSeconds > 0
                  ? "bg-amber-500"
                  : "bg-muted-foreground/60",
              )}
            />
            {currentRunning ? "Gravando" : currentSeconds > 0 ? "Pausado" : "Pronto"}
          </div>
          <button
            type="button"
            onClick={() => setIsCollapsed(true)}
            className="h-6 w-6 grid place-items-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Recolher para barra compacta"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Dígitos gigantes (+100% a +150% maiores que o original de 24px) */}
      <div className="w-full py-0.5 text-center select-none">
        <div className="font-mono text-4xl sm:text-5xl md:text-6xl font-black tabular-nums tracking-tight text-foreground leading-none">
          {formatSeconds(currentSeconds)}
        </div>
      </div>

      {/* Linha de botões de controle de toque ergonômicos */}
      <div className="flex w-full items-center justify-center gap-2 pt-1">
        <Button
          type="button"
          size="lg"
          className={cn(
            "flex-1 h-11 sm:h-12 rounded-xl text-sm sm:text-base font-bold shadow-sm transition-all duration-150 active:scale-[0.98]",
            currentRunning
              ? "bg-amber-500 text-white hover:bg-amber-600 shadow-amber-500/20"
              : currentSeconds > 0
              ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-600/20"
              : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20",
          )}
          onClick={() => setCurrentRunning(!currentRunning)}
        >
          {currentRunning ? (
            <>
              <Pause className="mr-1.5 h-5 w-5" /> Pausar
            </>
          ) : (
            <>
              <Play className="mr-1.5 h-5 w-5" /> {currentSeconds === 0 ? "Iniciar Treino" : "Retomar"}
            </>
          )}
        </Button>

        <Button
          type="button"
          size="lg"
          variant="outline"
          onClick={reset}
          disabled={currentSeconds === 0 && !currentRunning}
          className="h-11 sm:h-12 px-4 rounded-xl text-sm font-semibold border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground active:scale-[0.98] transition-all shrink-0"
          title="Zerar cronômetro"
        >
          <RotateCcw className="h-4 w-4 sm:mr-1.5 shrink-0" />
          <span className="hidden sm:inline">Zerar</span>
        </Button>
      </div>
    </div>
  );
}
