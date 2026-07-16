import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Timer } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

function format(seconds: number) {
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

export function SessionTimer() {
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const lastAlertRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    const startedAt = Date.now() - seconds * 1000;
    const id = window.setInterval(() => {
      const next = Math.floor((Date.now() - startedAt) / 1000);
      setSeconds(next);
      const hoursDone = Math.floor(next / 3600);
      if (hoursDone > lastAlertRef.current && next > 0) {
        lastAlertRef.current = hoursDone;
        playBeep();
        toast.info(`Sessão em andamento: ${hoursDone}h completada`);
      }
    }, 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  function reset() {
    setRunning(false);
    setSeconds(0);
    lastAlertRef.current = 0;
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center gap-2">
        <Timer className="h-4 w-4 text-primary" />
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Cronômetro da sessão
          </div>
          <div className="font-mono text-2xl tabular-nums">{format(seconds)}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={running ? "secondary" : "default"}
          onClick={() => setRunning((r) => !r)}
        >
          {running ? (
            <>
              <Pause className="mr-1 h-4 w-4" /> Pausar
            </>
          ) : (
            <>
              <Play className="mr-1 h-4 w-4" /> {seconds === 0 ? "Iniciar" : "Retomar"}
            </>
          )}
        </Button>
        <Button size="sm" variant="outline" onClick={reset} disabled={seconds === 0 && !running}>
          <RotateCcw className="mr-1 h-4 w-4" /> Zerar
        </Button>
      </div>
    </div>
  );
}
