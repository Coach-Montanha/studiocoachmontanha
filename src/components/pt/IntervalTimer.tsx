import { useEffect, useState } from "react";
import { Pause, Play, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface IntervalTimerProps {
  sets: number;
  workSeconds: number;
  restSeconds: number;
  onComplete?: () => void;
  onClose?: () => void;
}

export function IntervalTimer({
  sets,
  workSeconds,
  restSeconds,
  onComplete,
  onClose,
}: IntervalTimerProps) {
  const [currentSet, setCurrentSet] = useState(1);
  const [phase, setPhase] = useState<"work" | "rest">("work");
  const [timeLeft, setTimeLeft] = useState(workSeconds);
  const [running, setRunning] = useState(true);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    let timer: number;
    if (running && timeLeft > 0) {
      timer = window.setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (running && timeLeft === 0) {
      if (phase === "work") {
        if (restSeconds > 0) {
          setPhase("rest");
          setTimeLeft(restSeconds);
        } else if (currentSet < sets) {
          setCurrentSet((prev) => prev + 1);
          setPhase("work");
          setTimeLeft(workSeconds);
        } else {
          setFinished(true);
          setRunning(false);
          onComplete?.();
        }
      } else {
        // Finishing rest
        if (currentSet < sets) {
          setCurrentSet((prev) => prev + 1);
          setPhase("work");
          setTimeLeft(workSeconds);
        } else {
          setFinished(true);
          setRunning(false);
          onComplete?.();
        }
      }
      playBeep(phase === "work" ? 880 : 440);
    }
    return () => clearInterval(timer);
  }, [running, timeLeft, phase, currentSet, sets, workSeconds, restSeconds, onComplete]);

  function playBeep(freq: number) {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.02);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
      setTimeout(() => ctx.close(), 500);
    } catch (e) {
      console.error("Audio error", e);
    }
  }

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return {
      m: String(mins).padStart(2, "0"),
      s: String(secs).padStart(2, "0"),
    };
  };

  const { m, s } = formatTime(timeLeft);

  if (finished) {
    return (
      <div className="flex flex-col items-center justify-center space-y-6 py-8 animate-in fade-in zoom-in duration-300">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CheckCircle2 className="h-10 w-10" />
        </div>
        <div className="text-center">
          <h3 className="text-xl font-bold text-foreground">Treino concluído</h3>
          <p className="text-sm text-muted-foreground mt-1">Ótimo trabalho!</p>
        </div>
        <Button onClick={onClose} className="rounded-full px-8">Fechar</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center space-y-6 py-4">
      {/* 1 & 2. Sets counter */}
      <div className="flex flex-col items-center">
        <span className="text-5xl font-bold text-primary tabular-nums leading-none">{currentSet}</span>
        <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground mt-1">sets</span>
      </div>

      {/* 3. Progress bar */}
      <div className="flex gap-1.5 h-1.5 w-full max-w-[200px]">
        {Array.from({ length: sets }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "flex-1 rounded-full transition-colors duration-300",
              i + 1 <= currentSet ? "bg-primary" : "bg-primary/20"
            )}
          />
        ))}
      </div>

      {/* 4 & 5 & 6. Timer Circle */}
      <div className="relative flex items-center justify-center">
        <div className="h-56 w-56 rounded-full border-2 border-muted flex flex-col items-center justify-center bg-background shadow-inner">
          <div className="flex items-center text-6xl font-bold text-primary tracking-tighter tabular-nums">
            <div className="flex flex-col items-center">
              <span>{m}</span>
            </div>
            <div className="flex flex-col items-center px-1 self-center -mt-2">
              <div className="h-2 w-2 rounded-full bg-primary mb-2" />
              <div className="h-2 w-2 rounded-full bg-primary" />
            </div>
            <div className="flex flex-col items-center">
              <span>{s}</span>
            </div>
          </div>
          {/* Labels m and s */}
          <div className="flex w-32 justify-between px-2 mt-1">
            <span className="text-xs font-medium text-muted-foreground w-8 text-center">m</span>
            <span className="text-xs font-medium text-muted-foreground w-8 text-center">s</span>
          </div>
        </div>
      </div>

      {/* 7. Phase label */}
      <div className="text-center">
        <span className="text-3xl font-light tracking-widest text-muted-foreground/60 uppercase">
          {phase === "work" ? "Trabalho" : "Descanso"}
        </span>
      </div>

      {/* 8. Pause/Resume Button */}
      <Button
        onClick={() => setRunning(!running)}
        className="h-14 w-full max-w-[240px] rounded-full text-lg font-bold shadow-lg transition-transform active:scale-95"
      >
        {running ? (
          <>
            <Pause className="mr-2 h-5 w-5 fill-current" /> Pausar
          </>
        ) : (
          <>
            <Play className="mr-2 h-5 w-5 fill-current" /> Retomar
          </>
        )}
      </Button>
    </div>
  );
}
