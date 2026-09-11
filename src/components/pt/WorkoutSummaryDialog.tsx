import { useEffect, useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  MessageCircle, 
  Download, 
  Image as ImageIcon,
  CheckCircle2,
  Timer,
  Dumbbell,
  Layout,
  Upload,
  Eye,
  EyeOff,
  Check
} from "lucide-react";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import { formatSeconds } from "./SessionTimer";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface WorkoutSummaryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dayName: string;
  duration: number;
  exercises: any[];
  loads: Record<string, string>;
  feedback: string;
  executionId?: string;
  initialExcludedExercises?: string[];
  onExcludedExercisesChange?: (excludedIds: string[]) => void;
  completedSets?: Record<string, number[]>;
  doneExercises?: Record<string, boolean> | string[];
}

export function WorkoutSummaryDialog({
  open,
  onOpenChange,
  dayName,
  duration,
  exercises,
  loads,
  feedback,
  executionId,
  initialExcludedExercises,
  onExcludedExercisesChange,
  completedSets,
  doneExercises: doneProp,
}: WorkoutSummaryProps) {
  const [format, setFormat] = useState<"story" | "square">("story");
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [logoImage, setLogoImage] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [showFeedback, setShowFeedback] = useState(true);
  const [excludedIds, setExcludedIds] = useState<string[]>(initialExcludedExercises || []);

  const candidateExercises = exercises.filter((ex) => !ex.substitute_exercise_id);

  const isExercisePerformed = (ex: any) => {
    const isDone = Array.isArray(doneProp)
      ? doneProp.includes(ex.id)
      : !!doneProp?.[ex.id];
    const sets = completedSets?.[ex.id];
    const hasSets = Array.isArray(sets) && sets.length > 0;
    const hasLoad = !!(loads && loads[ex.id] && String(loads[ex.id]).trim());
    if (completedSets !== undefined || doneProp !== undefined) {
      return isDone || hasSets || hasLoad;
    }
    return true;
  };

  useEffect(() => {
    if (open) {
      // Automaticamente exclui da foto os exercícios que NÃO foram realizados
      const unperformedIds = candidateExercises
        .filter((ex) => !isExercisePerformed(ex))
        .map((ex) => ex.id);
      const combined = Array.from(new Set([...(initialExcludedExercises || []), ...unperformedIds]));
      setExcludedIds(combined);
    }
  }, [open, initialExcludedExercises]);

  useEffect(() => {
    async function loadLogo() {
      // Tenta carregar a logo do banco de dados primeiro
      const { data } = await supabase
        .from("studio_settings")
        .select("logo_pt_base64")
        .maybeSingle();
      
      if (data?.logo_pt_base64) {
        setLogoImage(data.logo_pt_base64);
      } else {
        // Fallback para localStorage
        const savedLogo = localStorage.getItem("coach.logo.pt");
        if (savedLogo) {
          setLogoImage(savedLogo);
        }
      }
    }
    
    if (open) {
      loadLogo();
    }
  }, [open]);

  const doneExercises = candidateExercises.filter((ex) => !excludedIds.includes(ex.id));

  const toggleExclude = async (exId: string) => {
    const next = excludedIds.includes(exId)
      ? excludedIds.filter((id) => id !== exId)
      : [...excludedIds, exId];

    setExcludedIds(next);
    onExcludedExercisesChange?.(next);

    if (executionId) {
      try {
        const { data: exec } = await supabase
          .from("pt_training_executions" as any)
          .select("notes")
          .eq("id", executionId)
          .single();

        let currentNotes: any = {};
        if (exec?.notes) {
          currentNotes = typeof exec.notes === "string" ? JSON.parse(exec.notes) : exec.notes;
        }
        currentNotes.excludedExercises = next;

        await supabase
          .from("pt_training_executions" as any)
          .update({ notes: JSON.stringify(currentNotes) })
          .eq("id", executionId);
      } catch (err) {
        console.error("Erro ao sincronizar exclusão:", err);
      }
    }
  };

  const handleBgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setBgImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };


  const generateImage = async () => {
    const node = document.getElementById("workout-share-card");
    if (!node) return null;
    
    setGenerating(true);
    try {
      const dataUrl = await toPng(node, {
        quality: 0.98,
        cacheBust: true,
        pixelRatio: 2.5,
      });
      setGenerating(false);
      return dataUrl;
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar imagem");
      setGenerating(false);
      return null;
    }
  };

  const handleShareWhatsApp = async () => {
    const dataUrl = await generateImage();
    if (!dataUrl) return;

    if (navigator.share && navigator.canShare) {
      try {
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const file = new File([blob], "treino.png", { type: "image/png" });
        
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: "Meu Treino de Hoje",
            text: `Treino ${dayName} concluído em ${formatSeconds(duration)}! 💪`,
          });
          return;
        }
      } catch (err) {
        console.error(err);
      }
    }

    const exercisesText = doneExercises
      .map((ex) => {
        const load = loads[ex.id] || ex.load;
        return `• ${ex.name}${load && load !== "—" ? ` (${load})` : ""}`;
      })
      .join("\n");

    const text = encodeURIComponent(
      `*Treino Concluído!* 💪\n\n*Rotina:* ${dayName}\n*Duração:* ${formatSeconds(duration)}\n\n${
        exercisesText ? `*Exercícios Realizados:*\n${exercisesText}\n\n` : ""
      }${feedback ? `*Feedback:* ${feedback}` : ""}`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const handleDownload = async (isInstagram = false) => {
    const dataUrl = await generateImage();
    if (!dataUrl) return;
    
    const link = document.createElement("a");
    link.download = `treino-${new Date().getTime()}.png`;
    link.href = dataUrl;
    link.click();
    
    if (isInstagram) {
      toast.success("Imagem salva! Agora abra o Instagram e selecione a foto na galeria.");
      // Tentativa de abrir o Instagram (pode não funcionar em todos os dispositivos/browsers por restrições de segurança)
      setTimeout(() => {
        window.location.href = "instagram://story-camera";
        // Fallback para web se o app não abrir
        setTimeout(() => {
          if (document.hasFocus()) {
            window.open("https://www.instagram.com", "_blank");
          }
        }, 1000);
      }, 500);
    } else {
      toast.success("Imagem salva com sucesso!");
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-xl overflow-y-auto max-h-[95vh] p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Resumo do Treino
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex flex-col items-center gap-4">
            <div className="w-full flex justify-center items-center overflow-x-hidden p-1">
              <div 
                id="workout-share-card"
                className={cn(
                  "relative flex flex-col bg-zinc-900 text-white shadow-2xl transition-all duration-300 border border-zinc-800 shrink-0 overflow-hidden rounded-3xl",
                  format === "story"
                    ? "w-full max-w-[350px] xs:max-w-[360px] min-h-[620px]"
                    : "w-full max-w-[350px] xs:max-w-[360px] aspect-square min-h-[350px]"
                )}
              >

                {bgImage ? (
                  <>
                    <img src={bgImage} className="absolute inset-0 h-full w-full object-cover opacity-60" alt="Background" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                  </>
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/40 via-zinc-900 to-zinc-900" />
                )}

                <div className="relative flex h-full flex-col p-5 sm:p-6">
                  <div className="flex flex-col items-center justify-center w-full mt-1 gap-2">
                    {logoImage ? (
                      <img src={logoImage} className="max-h-20 max-w-[130px] object-contain rounded" alt="Logo" />
                    ) : (
                      <div className="h-14 w-14 rounded-2xl bg-primary/20 flex items-center justify-center backdrop-blur-md border border-white/10">
                        <Dumbbell className="h-7 w-7 text-primary" />
                      </div>
                    )}
                  </div>

                  <div className="mt-4">
                    <h2 className="text-2xl xs:text-3xl font-black uppercase tracking-tighter leading-none italic italic-important">
                      Treino<br />Concluído
                    </h2>
                    <div className="mt-1.5 h-1 w-10 bg-primary" />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2 rounded-xl bg-white/10 p-2 backdrop-blur-md border border-white/5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/20 shrink-0">
                        <Layout className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[9px] font-bold uppercase text-zinc-400 leading-none mb-1">Rotina</div>
                        <div className="text-[11px] font-black leading-none truncate italic italic-important uppercase text-white">{dayName}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 rounded-xl bg-white/10 p-2 backdrop-blur-md border border-white/5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/20 shrink-0">
                        <Timer className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[9px] font-bold uppercase text-zinc-400 leading-none mb-1">Duração</div>
                        <div className="text-[11px] font-bold leading-none tabular-nums italic italic-important">{formatSeconds(duration)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider">Desempenho da Sessão</div>
                      <div className="text-[9px] font-medium text-primary/80">{doneExercises.length} Exercícios</div>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5 opacity-90">
                      {doneExercises.map((ex, i) => {
                        const load = loads[ex.id] || ex.load || "—";
                        
                        const setsDone = completedSets?.[ex.id];
                        const performedCount = Array.isArray(setsDone) ? setsDone.length : 0;
                        const setsMatch = ex.sets_reps ? String(ex.sets_reps).match(/^(\d+)\s*[xX]/) : null;
                        const totalSets = setsMatch ? parseInt(setsMatch[1], 10) : (typeof ex.series === "number" && ex.series > 0 ? ex.series : 3);
                        
                        // Formatação dinâmica baseada no tipo da série e no que foi REALMENTE feito
                        let detailText = "";
                        
                        if (ex.series_type === "time_inclination" || ex.series_type === "time") {
                          const timeStr = ex.time_seconds ? `${Math.floor(ex.time_seconds / 60)}min` : (ex.sets_reps || "2min");
                          if (performedCount > 0 && performedCount < totalSets) {
                            detailText = `${performedCount} de ${totalSets} séries · ${timeStr}`;
                          } else if (performedCount >= totalSets) {
                            detailText = `${totalSets} séries concluídas · ${timeStr}`;
                          } else {
                            detailText = `${timeStr}`;
                          }
                          if (ex.inclination) detailText += ` · Inc: ${ex.inclination}`;
                        } else if (ex.series_type === "run") {
                          detailText = `${ex.sets_reps || "Corrida"}${ex.pace ? ` · Pace: ${ex.pace}` : ""}`;
                        } else if (ex.series_type === "cadence") {
                          detailText = `Cad: ${ex.cadence || ex.sets_reps}`;
                        } else {
                          // Repetições e carga - limpa duplicações como "reps reps"
                          const cleanReps = (ex.sets_reps || "10-12")
                            .replace(/^(\d+\s*[xX]\s*)/, "")
                            .replace(/\s*reps?\s*$/i, "")
                            .trim();
                          const repsLabel = cleanReps ? `${cleanReps} reps` : "10-12 reps";
                          if (performedCount > 0 && performedCount < totalSets) {
                            detailText = `${performedCount} de ${totalSets} séries realizadas · ${repsLabel}`;
                          } else if (performedCount >= totalSets) {
                            detailText = `${totalSets} séries concluídas · ${repsLabel}`;
                          } else {
                            detailText = ex.sets_reps && ex.sets_reps.includes("reps") ? ex.sets_reps : `${ex.sets_reps || "10-12"} reps`;
                          }
                        }

                        const cleanRest = ex.rest_seconds ? String(ex.rest_seconds).replace(/\D/g, "") : "";

                        return (
                          <div key={i} className="flex flex-col gap-0.5 border-b border-white/5 pb-1.5 last:border-0">
                            <div className="flex items-center justify-between gap-3 text-[11px]">
                              <span className="truncate font-bold flex items-center gap-1.5 flex-1 italic uppercase">
                                <span className="h-1 w-1 rounded-full bg-primary/60 shrink-0" />
                                {ex.name}
                              </span>
                              <span className="shrink-0 font-black text-primary tabular-nums text-[12px] bg-primary/5 px-2 py-0.5 rounded italic">
                                {load}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 pl-2.5 text-[9px] text-zinc-400 font-medium italic italic-important">
                              <span>{detailText}</span>
                              {cleanRest && cleanRest !== "0" && (
                                <>
                                  <span className="h-0.5 w-0.5 rounded-full bg-zinc-600" />
                                  <span>Descanso: {cleanRest}s</span>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {feedback && showFeedback ? (
                    <div className="mt-3 rounded-lg bg-white/5 p-2.5 backdrop-blur-md border border-white/5">
                      <div className="text-[8px] font-bold uppercase text-primary/70 mb-0.5 tracking-widest">Feedback do Aluno</div>
                      <p className="text-[10px] leading-tight text-zinc-300 italic">"{feedback.length > 120 ? feedback.substring(0, 120) + '...' : feedback}"</p>
                    </div>
                  ) : !feedback && showFeedback ? (
                    <div className="mt-3 rounded-lg bg-primary/5 p-2.5 backdrop-blur-md border border-primary/10 border-dashed">
                      <p className="text-[10px] leading-tight text-primary/80 italic text-center font-medium">
                        "Mais um dia vencido com foco e determinação. A constância é o que constrói resultados reais."
                      </p>
                    </div>
                  ) : null}

                  <div className="mt-auto pt-4 pb-1 text-center">
                    <div className="text-[9px] font-black uppercase tracking-[0.2em] text-primary/80">Foco & Constância</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4 w-full">
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button
                  size="sm"
                  variant={format === "story" ? "default" : "outline"}
                  onClick={() => setFormat("story")}
                  className="gap-2"
                >
                  <Layout className="h-4 w-4" /> Story
                </Button>
                <Button
                  size="sm"
                  variant={format === "square" ? "default" : "outline"}
                  onClick={() => setFormat("square")}
                  className="gap-2"
                >
                  <Layout className="h-4 w-4 rotate-90" /> Quadrado
                </Button>
                
                <div className="relative">
                  <input
                    type="file"
                    id="bg-upload"
                    className="hidden"
                    accept="image/*"
                    capture="environment"
                    onChange={handleBgChange}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => document.getElementById("bg-upload")?.click()}
                    className="gap-2"
                  >
                    <ImageIcon className="h-4 w-4" /> {bgImage ? "Trocar Foto" : "Add Foto"}
                  </Button>
                </div>

                <div className="relative">
                  <input
                    type="file"
                    id="bg-gallery-upload"
                    className="hidden"
                    accept="image/*"
                    onChange={handleBgChange}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => document.getElementById("bg-gallery-upload")?.click()}
                    className="gap-2"
                  >
                    <Upload className="h-4 w-4" /> Galeria
                  </Button>
                </div>
              </div>

              {feedback && (
                <div className="flex items-center justify-center gap-2">
                  <Button
                    size="sm"
                    variant={showFeedback ? "default" : "outline"}
                    onClick={() => setShowFeedback(!showFeedback)}
                    className="text-[10px] h-7 px-2"
                  >
                    {showFeedback ? "Ocultar Feedback" : "Mostrar Feedback"}
                  </Button>
                </div>
              )}

              {/* Seletor interativo de exercícios na imagem */}
              {candidateExercises.length > 0 && (
                <div className="w-full rounded-xl border border-border/80 bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                      <Eye className="h-3.5 w-3.5 text-primary" />
                      Exercícios na foto ({doneExercises.length}/{candidateExercises.length})
                    </span>
                    <span className="text-[10px] text-muted-foreground hidden sm:inline">
                      Toque para incluir ou ocultar da imagem
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                    {candidateExercises.map((ex) => {
                      const isExcluded = excludedIds.includes(ex.id);
                      return (
                        <button
                          key={ex.id}
                          type="button"
                          onClick={() => toggleExclude(ex.id)}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all select-none active:scale-95",
                            isExcluded
                              ? "bg-muted/80 text-muted-foreground/60 line-through border border-border/50 hover:text-muted-foreground"
                              : "bg-primary/10 text-primary border border-primary/25 hover:bg-primary/20 shadow-xs"
                          )}
                          title={
                            isExcluded
                              ? `Clique para reexibir "${ex.name}" na foto`
                              : `Clique para ocultar "${ex.name}" da foto`
                          }
                        >
                          {isExcluded ? (
                            <EyeOff className="h-3 w-3 shrink-0 text-muted-foreground/70" />
                          ) : (
                            <Check className="h-3 w-3 shrink-0 text-primary" />
                          )}
                          <span className="truncate max-w-[150px] sm:max-w-[200px]">{ex.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-4 border-t">
          <Button 
            variant="outline" 
            className="flex-1 gap-2"
            onClick={() => handleDownload(false)}
            disabled={generating}
          >
            <Download className="h-4 w-4" />
            Salvar Foto
          </Button>
          <Button 
            variant="outline" 
            className="flex-1 gap-2 border-[#25D366] text-[#25D366] hover:bg-[#25D366]/10"
            onClick={handleShareWhatsApp}
            disabled={generating}
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </Button>
          <Button 
            className="flex-1 gap-2 bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#FCB045]"
            onClick={() => handleDownload(true)}
            disabled={generating}
          >
            Postar Story
          </Button>

        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}