import { useState } from "react";
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
  Layout
} from "lucide-react";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import { formatSeconds } from "./SessionTimer";
import { cn } from "@/lib/utils";

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

  const doneExercises = exercises.filter(ex => !ex.substitute_exercise_id);

  const handleBgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setBgImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setLogoImage(reader.result as string);
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

    // Em navegadores modernos, podemos tentar usar a API de compartilhamento
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

    // Fallback para link do WhatsApp (texto apenas)
    const text = encodeURIComponent(`*Treino Concluído!* 💪\n\n*Rotina:* ${dayName}\n*Duração:* ${formatSeconds(duration)}\n\n${feedback ? `*Feedback:* ${feedback}` : ""}`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const handleDownload = async () => {
    const dataUrl = await generateImage();
    if (!dataUrl) return;
    
    const link = document.createElement("a");
    link.download = `treino-${new Date().getTime()}.png`;
    link.href = dataUrl;
    link.click();
    toast.success("Imagem salva com sucesso!");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Resumo do Treino
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Preview Area */}
          <div className="flex flex-col items-center gap-4">
            <div 
              id="workout-share-card"
              className={cn(
                "relative overflow-hidden bg-zinc-900 text-white shadow-2xl transition-all duration-300 border border-zinc-800",
                format === "story" ? "aspect-[9/16] w-[280px]" : "aspect-square w-[320px]"
              )}
            >
              {/* Background */}
              {bgImage ? (
                <>
                  <img src={bgImage} className="absolute inset-0 h-full w-full object-cover opacity-60" alt="Background" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                </>
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-primary/40 via-zinc-900 to-zinc-900" />
              )}

              {/* Content */}
              <div className="relative flex h-full flex-col p-6">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    {logoImage ? (
                      <img src={logoImage} className="h-8 w-8 object-contain rounded" alt="Logo" />
                    ) : (
                      <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                        <Dumbbell className="h-5 w-5 text-white" />
                      </div>
                    )}
                    <span className="text-[10px] font-bold tracking-tighter uppercase max-w-[120px] truncate leading-tight">
                      Studio Coach Montanha
                    </span>
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 backdrop-blur-md">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  </div>
                </div>

                {executionId && (
                  <div className="absolute top-6 right-6 text-[9px] font-mono opacity-50 uppercase tracking-widest">
                    #{executionId.slice(0, 8)}
                  </div>
                )}

                <div className="mt-8">
                  <h2 className="text-3xl font-black uppercase tracking-tighter leading-none italic italic-important">
                    Treino<br />Concluído
                  </h2>
                  <div className="mt-2 h-1 w-12 bg-primary" />
                </div>

                <div className="mt-8 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-md">
                      <Layout className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase text-zinc-400">Rotina</div>
                      <div className="font-bold leading-none">{dayName}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-md">
                      <Timer className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase text-zinc-400">Duração</div>
                      <div className="font-bold leading-none tabular-nums">{formatSeconds(duration)}</div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex-1 overflow-hidden">
                  <div className="text-[10px] font-bold uppercase text-zinc-400 mb-2">Exercícios</div>
                  <div className="space-y-1.5 opacity-90">
                    {doneExercises.slice(0, 6).map((ex, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 text-xs border-b border-white/10 pb-1">
                        <span className="truncate font-medium">{ex.name}</span>
                        <span className="shrink-0 font-bold text-primary">{loads[ex.id] || ex.load || "—"}</span>
                      </div>
                    ))}
                    {doneExercises.length > 6 && (
                      <div className="text-[10px] font-medium text-zinc-500 italic">
                        + {doneExercises.length - 6} outros exercícios
                      </div>
                    )}
                  </div>
                </div>

                {feedback && (
                  <div className="mt-4 rounded-lg bg-white/5 p-3 backdrop-blur-md">
                    <p className="text-[10px] leading-tight text-zinc-300 italic">"{feedback.length > 80 ? feedback.substring(0, 80) + '...' : feedback}"</p>
                  </div>
                )}

                <div className="mt-auto pt-6 text-center">
                  <div className="text-[9px] font-black uppercase tracking-[0.2em] text-primary/80">Foco & Constância</div>
                </div>
              </div>
            </div>

            {/* Controls */}
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
                  onChange={handleFileChange}
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
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-4 border-t">
          <Button 
            variant="outline" 
            className="flex-1 gap-2"
            onClick={handleDownload}
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
            onClick={handleDownload}
            disabled={generating}
          >
            Postar Story
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
