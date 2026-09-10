import { useState, useEffect } from "react";
import { Bot, Sparkles, MessageCircle, Copy, Check, Send, ShieldAlert, Dumbbell, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  generateWorkoutWhatsAppFeedback,
  createWhatsAppUrl,
  CLINICAL_EXERCISE_RULES,
} from "@/lib/coach-ai";
import { loadCoachMemory, saveCoachMemory } from "@/lib/coach-memory";
import { extractClinicalAlerts, type StudentAnamnesis } from "@/lib/anamnesis";

export interface CoachAiCopilotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: {
    id: string;
    name: string;
    phone?: string | null;
    goal?: string | null;
  };
  latestExecution?: any;
  anamnesis?: StudentAnamnesis | null;
}

export function CoachAiCopilotDialog({
  open,
  onOpenChange,
  student,
  latestExecution,
  anamnesis,
}: CoachAiCopilotDialogProps) {
  // Load persisted memory when dialog opens
  const [memory, setMemory] = useState(() => loadCoachMemory(student.id) || {});
  // Generate initial feedback or use saved memory
  const initialFeedback = memory.lastFeedback || generateWorkoutWhatsAppFeedback({
    studentName: student.name,
    studentPhone: student.phone,
    workoutName: latestExecution?.pt_training_days?.name || "Treino Personal",
    timerSeconds: (() => {
      let parsed: any = {};
      if (latestExecution?.notes) {
        try {
          parsed = typeof latestExecution.notes === "string" ? JSON.parse(latestExecution.notes) : latestExecution.notes;
        } catch {}
      }
      return parsed.timerSeconds || 0;
    })(),
    loads: (() => {
      let parsed: any = {};
      if (latestExecution?.notes) {
        try {
          parsed = typeof latestExecution.notes === "string" ? JSON.parse(latestExecution.notes) : latestExecution.notes;
        } catch {}
      }
      return parsed.loads || {};
    })(),
    totalExercisesDone: (() => {
      let parsed: any = {};
      if (latestExecution?.notes) {
        try {
          parsed = typeof latestExecution.notes === "string" ? JSON.parse(latestExecution.notes) : latestExecution.notes;
        } catch {}
      }
      return Array.isArray(parsed.doneExercises) ? parsed.doneExercises.length : 0;
    })(),
  });
  const [feedbackText, setFeedbackText] = useState(initialFeedback);

  // Persist feedback when it changes while dialog is open
  useEffect(() => {
    if (open) {
      saveCoachMemory(student.id, { ...memory, lastFeedback: feedbackText });
    }
  }, [feedbackText, open]);

  // Reset local state when dialog closes
  useEffect(() => {
    if (!open) {
      setMemory(loadCoachMemory(student.id) || {});
    }
  }, [open, student.id]);

  const [copied, setCopied] = useState(false);


  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(feedbackText);
      setCopied(true);
      toast.success("Mensagem copiada para a área de transferência!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar o texto.");
    }
  };

  const handleSendWhatsApp = () => {
    const url = createWhatsAppUrl(student.phone, feedbackText);
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
    toast.success("Abrindo WhatsApp...", { icon: "💬" });
  };

  const clinicalAlerts = extractClinicalAlerts(anamnesis);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-wider">
            <Bot className="h-4 w-4" />
            <span>Assistente do Treinador</span>
          </div>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Coach AI Copilot
          </DialogTitle>
          <DialogDescription>
            Gere mensagens técnicas para envio no WhatsApp e consulte diretrizes de prescrição segura com base na saúde do aluno.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="feedback" className="py-2 space-y-4">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="feedback" className="gap-1.5">
              <MessageCircle className="h-4 w-4" />
              Feedback WhatsApp
            </TabsTrigger>
            <TabsTrigger value="safety" className="gap-1.5">
              <ShieldAlert className="h-4 w-4" />
              Prescrição Segura
            </TabsTrigger>
          </TabsList>

          {/* ABA 1: Feedback para WhatsApp */}
          <TabsContent value="feedback" className="space-y-3">
            <div className="rounded-2xl bg-muted/40 border p-3 flex items-center justify-between gap-3 text-xs">
              <div>
                <span className="font-bold text-muted-foreground uppercase text-[10px] block">
                  Destinatário
                </span>
                <span className="font-bold text-foreground">{student.name}</span>
                {student.phone ? (
                  <span className="text-muted-foreground ml-1.5">({student.phone})</span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400 ml-1.5">(sem telefone cadastrado)</span>
                )}
              </div>
              <span className="rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 font-bold text-[10px] border border-emerald-500/20">
                Pós-treino
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span>Mensagem Personalizada</span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 text-primary hover:underline font-bold"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copiado!" : "Copiar Texto"}
                </button>
              </div>
              <Textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                className="min-h-[190px] text-xs font-sans leading-relaxed resize-y"
              />
            </div>
          </TabsContent>

          {/* ABA 2: Diretrizes de Prescrição Segura */}
          <TabsContent value="safety" className="space-y-3.5">
            <div className="rounded-2xl border bg-muted/20 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <h4 className="text-sm font-bold text-foreground">
                  Restrições Mapeadas do Aluno
                </h4>
              </div>

              {clinicalAlerts.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {clinicalAlerts.map((alert, idx) => (
                    <span
                      key={idx}
                      className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-300"
                    >
                      ⚠️ {alert}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Nenhuma restrição articular ou clínica severa cadastrada na anamnese. Aluno apto para prescrição padrão.
                </p>
              )}
            </div>

            <div className="space-y-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                Regras Biomecânicas Recomendadas pelo Copilot:
              </span>
              <div className="space-y-2 text-xs">
                {CLINICAL_EXERCISE_RULES.map((rule, idx) => (
                  <div key={idx} className="rounded-2xl border p-3 bg-card space-y-1.5">
                    <div className="font-bold text-foreground flex items-center gap-1.5">
                      <Dumbbell className="h-3.5 w-3.5 text-primary" />
                      <span>{rule.joint}</span>
                    </div>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      {rule.reason}
                    </p>
                    <div className="pt-1 flex flex-wrap gap-1">
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mr-1">
                        Preferir:
                      </span>
                      {rule.safeAlternatives.map((alt, i) => (
                        <span key={i} className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground">
                          {alt}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button
            onClick={handleSendWhatsApp}
            className="gap-1.5 font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20"
          >
            <Send className="h-4 w-4" />
            Enviar no WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
