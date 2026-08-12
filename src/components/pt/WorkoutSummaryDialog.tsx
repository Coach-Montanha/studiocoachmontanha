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
  Upload
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
}

export function WorkoutSummaryDialog({
  open,
  onOpenChange,
  dayName,
  duration,
  exercises,
  loads,
  feedback,
  executionId
}: WorkoutSummaryProps) {
  const [format, setFormat] = useState<"story" | "square">("story");
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [logoImage, setLogoImage] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

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

  const doneExercises = exercises.filter(ex => !ex.substitute_exercise_id);

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
      const dataUrl = await toPng(node, { quality: 0.95, cacheBust: true });
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

    const text = encodeURIComponent(`*Treino Concluído!* 💪\n\n*Rotina:* ${dayName}\n*Duração:* ${formatSeconds(duration)}\n\n${feedback ? `*Feedback:* ${feedback}` : ""}`);
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
            <div 
              id="workout-share-card"
              className={cn(
                "relative flex flex-col bg-zinc-900 text-white shadow-2xl transition-all duration-300 border border-zinc-800 shrink-0 overflow-hidden",
                format === "story" ? "min-h-[700px] w-[393px]" : "min-h-[500px] w-[500px]"
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

              <div className="relative flex h-full flex-col p-6">
                <div className="flex flex-col items-center justify-center w-full mt-4 gap-4">
                  {logoImage ? (
                    <img src={logoImage} className="h-36 w-36 object-contain rounded" alt="Logo" />
                  ) : (
                    <div className="h-36 w-36 rounded-3xl bg-primary/20 flex items-center justify-center backdrop-blur-md border border-white/10">
                      <Dumbbell className="h-16 w-16 text-primary" />
                    </div>
                  )}
                </div>


                <div className="mt-8">
                  <h2 className="text-3xl font-black uppercase tracking-tighter leading-none italic italic-important">
                    Treino<br />Concluído
                  </h2>
                  <div className="mt-2 h-1 w-12 bg-primary" />
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2.5 rounded-xl bg-white/10 p-2.5 backdrop-blur-md border border-white/5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20">
                      <Layout className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[9px] font-bold uppercase text-zinc-400 leading-none mb-1">Rotina</div>
                      <div className="text-[11px] font-black leading-none truncate italic italic-important uppercase text-white">{dayName}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 rounded-xl bg-white/10 p-2.5 backdrop-blur-md border border-white/5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20">
                      <Timer className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[9px] font-bold uppercase text-zinc-400 leading-none mb-1">Duração</div>
                      <div className="text-xs font-bold leading-none tabular-nums italic italic-important">{formatSeconds(duration)}</div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider">Desempenho da Sessão</div>
                    <div className="text-[9px] font-medium text-primary/80">{doneExercises.length} Exercícios</div>
                  </div>
                  <div className="grid grid-cols-1 gap-1.5 opacity-90">
                    {doneExercises.map((ex, i) => {
                      const sets = ex.series || 3;
                      const reps = ex.reps || "10-12";
                      return (
                        <div key={i} className="flex flex-col gap-0.5 border-b border-white/5 pb-1.5 last:border-0">
                          <div className="flex items-center justify-between gap-3 text-[11px]">
                            <span className="truncate font-bold flex items-center gap-1.5 flex-1 italic uppercase">
                              <span className="h-1 w-1 rounded-full bg-primary/60 shrink-0" />
                              {ex.name}
                            </span>
                            <span className="shrink-0 font-black text-primary tabular-nums text-[12px] bg-primary/5 px-2 py-0.5 rounded italic">
                              {loads[ex.id] || ex.load || "—"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 pl-2.5 text-[9px] text-zinc-400 font-medium italic italic-important">
                            <span>{sets} séries</span>
                            <span className="h-0.5 w-0.5 rounded-full bg-zinc-600" />
                            <span>{reps} reps</span>
                            {ex.rest && (
                              <>
                                <span className="h-0.5 w-0.5 rounded-full bg-zinc-600" />
                                <span>Descanso: {ex.rest}s</span>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>


                {feedback ? (
                  <div className="mt-4 rounded-lg bg-white/5 p-3 backdrop-blur-md border border-white/5">
                    <div className="text-[8px] font-bold uppercase text-primary/70 mb-1 tracking-widest">Feedback do Aluno</div>
                    <p className="text-[10px] leading-tight text-zinc-300 italic">"{feedback.length > 120 ? feedback.substring(0, 120) + '...' : feedback}"</p>
                  </div>
                ) : (
                  <div className="mt-4 rounded-lg bg-primary/5 p-3 backdrop-blur-md border border-primary/10 border-dashed">
                    <p className="text-[10px] leading-tight text-primary/80 italic text-center font-medium">
                      "Mais um dia vencido com foco e determinação. A constância é o que constrói resultados reais."
                    </p>
                  </div>
                )}

                <div className="mt-auto pt-6 text-center">
                  <div className="text-[9px] font-black uppercase tracking-[0.2em] text-primary/80">Foco & Constância</div>
                </div>
              </div>
            </div>

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