import { useEffect, useRef, useState } from "react";
import { Play, Pause, X, Plus, Minus, Dumbbell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface RestCountdownTimerProps {
  active: boolean;
  initialSeconds?: number;
  exerciseName?: string;
  currentSet?: number;
  totalSets?: number;
  onComplete?: () => void;
  onDismiss?: () => void;
  className?: string;
}

function playCompletionChime() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const playTone = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + start + 0.02);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + start + dur);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur);
    };

    // Acorde agradável de finalização de descanso
    playTone(523.25, 0.0, 0.25); // C5
    playTone(659.25, 0.15, 0.25); // E5
    playTone(783.99, 0.3, 0.4); // G5
    playTone(1046.5, 0.45, 0.5); // C6

    setTimeout(() => ctx.close(), 1800);
  } catch {
    // Ignora restrições de áudio
  }

  // Vibração tátil no celular se suportado
  if (typeof window !== "undefined" && "navigator" in window && "vibrate" in navigator) {
    try {
      navigator.vibrate([200, 100, 200, 100, 300]);
    } catch {
      // ignore
    }
  }
}

export function RestCountdownTimer({
  active,
  initialSeconds = 60,
  exerciseName,
  currentSet,
  totalSets,
  onComplete,
  onDismiss,
  className,
}: RestCountdownTimerProps) {
  const [totalTime, setTotalTime] = useState(initialSeconds);
  const [remaining, setRemaining] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(true);
  const hasFinishedRef = useRef(false);

  // Reinicia quando o timer é ativado ou a duração muda
  useEffect(() => {
    if (active) {
      const sec = initialSeconds > 0 ? initialSeconds : 60;
      setTotalTime(sec);
      setRemaining(sec);
      setIsRunning(true);
      hasFinishedRef.current = false;
    }
  }, [active, initialSeconds]);

  // Contagem regressiva de segundo em segundo
  useEffect(() => {
    if (!active || !isRunning) return;

    if (remaining <= 0) {
      if (!hasFinishedRef.current) {
        hasFinishedRef.current = true;
        playCompletionChime();
        toast.success("Descanso concluído! Bora para a próxima série 💪", {
          icon: "⏰",
        });
        onComplete?.();
      }
      return;
    }

    const timer = setInterval(() => {
      setRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [active, isRunning, remaining, onComplete]);

  if (!active) return null;

  const progressPercent = totalTime > 0 ? Math.max(0, Math.min(100, (remaining / totalTime) * 100)) : 0;
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const formattedTime = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const adjustTime = (delta: number) => {
    setRemaining((prev) => {
      const next = Math.max(0, prev + delta);
      if (next > totalTime) setTotalTime(next);
      return next;
    });
  };

  const setPreset = (sec: number) => {
    setTotalTime(sec);
    setRemaining(sec);
    setIsRunning(true);
    hasFinishedRef.current = false;
  };

  const isCompleted = remaining === 0;

  return (
    <div
      className={cn(
        "fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[94%] max-w-md",
        "animate-in fade-in slide-in-from-bottom-5 duration-300",
        className,
      )}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-3xl border shadow-2xl p-4 sm:p-5 backdrop-blur-xl transition-all",
          isCompleted
            ? "border-emerald-500 bg-emerald-950/90 text-white shadow-emerald-500/30"
            : "border-primary/40 bg-zinc-950/95 text-white shadow-primary/20",
        )}
      >
        {/* Barra de progresso linear no topo */}
        <div className="absolute inset-x-0 top-0 h-1.5 bg-white/10">
          <div
            className={cn(
              "h-full transition-all duration-1000 ease-linear",
              isCompleted ? "bg-emerald-400" : "bg-gradient-to-r from-amber-500 via-primary to-emerald-400",
            )}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          {/* Informações do exercício / série */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground/80">
              <Dumbbell className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="truncate max-w-[180px] sm:max-w-[220px] text-zinc-300">
                {exerciseName || "Descanso entre séries"}
              </span>
              {currentSet !== undefined && (
                <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary shrink-0">
                  Série {currentSet}{totalSets ? `/${totalSets}` : ""}
                </span>
              )}
            </div>
            <div className="mt-0.5 text-xs font-medium text-zinc-400">
              {isCompleted ? "Pronto para recomeçar!" : "Recuperação muscular ativa"}
            </div>
          </div>

          {/* Botão de Fechar */}
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Fechar cronômetro de descanso"
            className="rounded-full p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Display Central do Tempo */}
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <span
              className={cn(
                "font-mono text-4xl sm:text-5xl font-black tabular-nums tracking-tight",
                isCompleted ? "text-emerald-400 animate-pulse" : "text-white",
              )}
            >
              {formattedTime}
            </span>
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              {isCompleted ? "Fim" : "Restante"}
            </span>
          </div>

          {/* Controles de Reprodução */}
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => adjustTime(-15)}
              disabled={remaining <= 15}
              className="h-9 w-9 p-0 rounded-xl border-white/10 bg-white/5 hover:bg-white/15 text-white"
              title="-15 segundos"
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => adjustTime(15)}
              className="h-9 w-9 p-0 rounded-xl border-white/10 bg-white/5 hover:bg-white/15 text-white"
              title="+15 segundos"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => setIsRunning(!isRunning)}
              className={cn(
                "h-9 px-3.5 rounded-xl font-bold text-xs gap-1.5 transition-all shadow-md active:scale-95",
                isRunning
                  ? "bg-amber-500 hover:bg-amber-600 text-black"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white",
              )}
            >
              {isRunning ? (
                <>
                  <Pause className="h-3.5 w-3.5" /> Pausar
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" /> Continuar
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Presets Rápidos de Descanso */}
        <div className="mt-3.5 flex items-center gap-1.5 overflow-x-auto pt-1 pb-0.5 scrollbar-none">
          {[30, 45, 60, 90, 120].map((sec) => (
            <button
              key={sec}
              type="button"
              onClick={() => setPreset(sec)}
              className={cn(
                "rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all shrink-0",
                totalTime === sec
                  ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                  : "bg-white/10 text-zinc-300 hover:bg-white/20 hover:text-white",
              )}
            >
              {sec}s
            </button>
          ))}
          {isCompleted && (
            <button
              type="button"
              onClick={onDismiss}
              className="ml-auto rounded-lg bg-emerald-500/20 px-2.5 py-1 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/30 transition-all shrink-0"
            >
              Concluir ✕
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
