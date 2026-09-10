import { useRef, useState } from "react";
import { Download, Share2, Sparkles, Dumbbell, Timer, Flame, CheckCircle2, X } from "lucide-react";
import * as htmlToImage from "html-to-image";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatDateBR } from "@/lib/format";

export interface WorkoutStoryData {
  studentName: string;
  workoutName: string;
  executedAt: string;
  timerSeconds?: number;
  loads?: Record<string, string>;
  excludedCount?: number;
}

export function WorkoutStoryModal({
  open,
  onOpenChange,
  data,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: WorkoutStoryData | null;
}) {
  const storyRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  if (!data) return null;

  const durationMin = data.timerSeconds ? Math.floor(data.timerSeconds / 60) : null;
  const loadEntries = Object.entries(data.loads || {}).slice(0, 4);

  const handleDownloadImage = async () => {
    if (!storyRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await htmlToImage.toPng(storyRef.current, {
        pixelRatio: 3,
        cacheBust: true,
      });

      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `treino-${data.studentName.toLowerCase().replace(/\s+/g, "-")}-${data.executedAt.slice(0, 10)}.png`;
      a.click();

      toast.success("Imagem gerada em alta resolução para seus Stories!");
    } catch (err: any) {
      toast.error(`Erro ao gerar imagem: ${err.message}`);
    }
    setExporting(false);
  };

  const handleNativeShare = async () => {
    if (!storyRef.current) return;
    setExporting(true);
    try {
      const blob = await htmlToImage.toBlob(storyRef.current, {
        pixelRatio: 3,
        cacheBust: true,
      });

      if (blob && navigator.canShare && navigator.canShare({ files: [new File([blob], "treino.png", { type: "image/png" })] })) {
        const file = new File([blob], "treino-coach-montanha.png", { type: "image/png" });
        await navigator.share({
          title: `Treino de ${data.studentName} no Studio Coach Montanha`,
          text: `Treino concluído com sucesso! ⚡🏋️‍♂️`,
          files: [file],
        });
        toast.success("Compartilhado com sucesso!");
      } else {
        // Fallback to download
        await handleDownloadImage();
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        toast.error(`Erro ao compartilhar: ${err.message}`);
      }
    }
    setExporting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[95vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" /> Story de Vitória (9:16)
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center space-y-4 py-2">
          {/* The 9:16 Canvas */}
          <div
            ref={storyRef}
            className="relative w-[300px] h-[533px] rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between p-6 text-white select-none border border-white/10"
            style={{
              background: "linear-gradient(145deg, #09090b 0%, #18181b 45%, #050505 100%)",
            }}
          >
            {/* Subtle glow circle top */}
            <div className="absolute -top-20 -right-20 w-48 h-48 bg-primary/25 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="relative z-10 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-full border border-amber-400/25">
                  Studio Coach Montanha
                </span>
                <span className="text-[10px] font-medium text-zinc-400">
                  {formatDateBR(data.executedAt)}
                </span>
              </div>
              <div className="pt-3">
                <p className="text-xs text-zinc-400 font-medium">Aluno em evolução:</p>
                <h2 className="text-xl font-black tracking-tight text-white">{data.studentName}</h2>
              </div>
            </div>

            {/* Center Content */}
            <div className="relative z-10 my-auto space-y-4 text-center">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-amber-500 text-white shadow-lg shadow-primary/20 mx-auto">
                <Dumbbell className="h-8 w-8 stroke-[2.5]" />
              </div>

              <div>
                <div className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-widest text-primary">
                  <CheckCircle2 className="h-3 w-3" /> Missão Cumprida
                </div>
                <h3 className="text-lg font-extrabold text-white mt-0.5 leading-snug">
                  {data.workoutName || "Treino Personalizado"}
                </h3>
              </div>

              {/* Stats Highlights */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                {durationMin && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-2.5 backdrop-blur-sm">
                    <div className="flex items-center justify-center gap-1 text-[10px] text-zinc-400 font-bold uppercase">
                      <Timer className="h-3 w-3 text-primary" /> Tempo
                    </div>
                    <div className="text-sm font-black text-white mt-0.5">{durationMin} min</div>
                  </div>
                )}
                <div className="rounded-xl border border-white/10 bg-white/5 p-2.5 backdrop-blur-sm">
                  <div className="flex items-center justify-center gap-1 text-[10px] text-zinc-400 font-bold uppercase">
                    <Flame className="h-3 w-3 text-amber-400" /> Foco
                  </div>
                  <div className="text-sm font-black text-white mt-0.5">100% Pago</div>
                </div>
              </div>

              {/* Sample Loads */}
              {loadEntries.length > 0 && (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-left space-y-1">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">
                    Cargas Principais:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {loadEntries.map(([exId, load]) => (
                      <span
                        key={exId}
                        className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-bold text-amber-300"
                      >
                        ⚡ #{exId.slice(-4)}: {load}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="relative z-10 border-t border-white/10 pt-3 text-center space-y-0.5">
              <p className="text-[10px] font-bold tracking-wider text-white">#VemProCoachMontanha</p>
              <p className="text-[9px] text-zinc-500 font-medium">Resultados Reais · Disciplina Diária</p>
            </div>
          </div>

          {/* Export Actions */}
          <div className="flex w-full flex-col sm:flex-row gap-2 pt-2">
            <Button
              type="button"
              className="flex-1"
              disabled={exporting}
              onClick={handleDownloadImage}
            >
              <Download className="h-4 w-4 mr-2" />
              {exporting ? "Gerando PNG..." : "Baixar Imagem (Stories)"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={exporting}
              onClick={handleNativeShare}
            >
              <Share2 className="h-4 w-4 mr-2 text-primary" /> Compartilhar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
