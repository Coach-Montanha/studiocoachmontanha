import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Share2, Trash2, Edit2, Check, X, ClipboardList, History, Calendar, Timer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatDateBR } from "@/lib/format";
import { formatSeconds } from "./SessionTimer";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { WorkoutSummaryDialog } from "./WorkoutSummaryDialog";

export function HistoryShareSelector({ studentId }: { studentId: string }) {
  const [selectedExec, setSelectedExec] = useState<any>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [listDialogOpen, setListDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFeedback, setEditFeedback] = useState("");
  const qc = useQueryClient();

  const { data: history = [], isLoading } = useQuery({
    queryKey: ["pt-execution-history-share", studentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("pt_training_executions" as any)
        .select(`
          id,
          executed_at,
          feedback,
          notes,
          training_day_id,
          pt_training_days (
            name,
            program_id
          )
        `)
        .eq("pt_student_id", studentId)
        .order("executed_at", { ascending: false })
        .limit(20);
      return (data ?? []) as any[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("pt_training_executions" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pt-execution-history-share", studentId] });
      toast.success("Registro removido com sucesso");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, feedback }: { id: string; feedback: string }) => {
      const { error } = await supabase
        .from("pt_training_executions" as any)
        .update({ feedback })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pt-execution-history-share", studentId] });
      setEditingId(null);
      toast.success("Feedback atualizado!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Precisamos buscar os exercícios para o dia selecionado
  const { data: exercises = [] } = useQuery({
    queryKey: ["pt-history-exercises", selectedExec?.training_day_id],
    enabled: !!selectedExec?.training_day_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("pt_training_exercises" as any)
        .select("*")
        .eq("training_day_id", selectedExec.training_day_id)
        .order("sort_order", { ascending: true });
      return (data ?? []) as any[];
    },
  });

  const handleShare = (exec: any) => {
    setSelectedExec(exec);
    setSummaryOpen(true);
  };

  const startEdit = (exec: any) => {
    setEditingId(exec.id);
    setEditFeedback(exec.feedback || "");
  };

  if (isLoading) {
    return (
      <div className="h-16 rounded-2xl bg-muted/40 animate-pulse flex items-center px-4 text-xs text-muted-foreground">
        Carregando relatório de treinos...
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-2xl border border-dashed border-border bg-card/40 text-muted-foreground">
        <ClipboardList className="h-5 w-5 text-muted-foreground/60 shrink-0" />
        <div className="text-xs">Nenhum treino anterior registrado ainda.</div>
      </div>
    );
  }

  const latestExec = history[0];

  return (
    <>
      {/* Visualização compacta e limpa: apenas um card de resumo com botão de abertura */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs transition-all hover:border-primary/40">
        <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-foreground">Relatório de Treinos Anteriores</div>
              <div className="text-xs text-muted-foreground truncate mt-0.5">
                {history.length} {history.length === 1 ? "sessão registrada" : "sessões registradas"}
              </div>
            </div>
          </div>

          <Button
            type="button"
            onClick={() => setListDialogOpen(true)}
            size="sm"
            className="gap-1.5 rounded-xl font-semibold shadow-xs shrink-0 self-start xs:self-auto"
          >
            <History className="h-4 w-4" />
            <span>Ver Relatório ({history.length})</span>
          </Button>
        </div>

        {/* Resumo do último treino com atalho para compartilhar */}
        {latestExec && (
          <div className="mt-1 pt-3 border-t border-border/60 flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="truncate">
              Último: <strong className="text-foreground">{latestExec.pt_training_days?.name || "Treino"}</strong> ({formatDateBR(latestExec.executed_at)})
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleShare(latestExec)}
              className="h-7 px-2 text-[11px] font-semibold text-primary hover:bg-primary/10 rounded-lg shrink-0 gap-1"
            >
              <Share2 className="h-3 w-3" />
              <span>Foto</span>
            </Button>
          </div>
        )}
      </div>

      {/* Janela Modal completa com todas as informações e histórico */}
      <Dialog open={listDialogOpen} onOpenChange={setListDialogOpen}>
        <DialogContent className="max-w-lg w-[95vw] sm:w-full max-h-[85vh] overflow-y-auto rounded-2xl p-4 sm:p-6 space-y-4">
          <DialogHeader className="text-left space-y-1">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">
                {history.length} {history.length === 1 ? "registro" : "registros"}
              </span>
            </div>
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl font-bold text-foreground">
              <ClipboardList className="h-5 w-5 text-primary" />
              Relatório de Treinos Anteriores
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Histórico das sessões realizadas. Gere imagens para Story/WhatsApp, edite feedbacks ou consulte cargas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-1">
            {history.map((exec) => {
              let parsedNotes: any = {};
              try {
                parsedNotes = typeof exec.notes === "string" ? JSON.parse(exec.notes) : (exec.notes || {});
              } catch {}

              return (
                <div
                  key={exec.id}
                  className="flex flex-col gap-2 rounded-xl border border-border bg-card/70 p-3.5 hover:border-primary/40 hover:bg-muted/20 transition-all shadow-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                        <Calendar className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold truncate text-foreground">
                          {exec.pt_training_days?.name || "Treino"}
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          <span>{formatDateBR(exec.executed_at)}</span>
                          {parsedNotes?.timerSeconds ? (
                            <>
                              <span>•</span>
                              <span className="inline-flex items-center gap-0.5 tabular-nums text-foreground/80">
                                <Timer className="h-3 w-3 text-muted-foreground" />
                                {formatSeconds(parsedNotes.timerSeconds)}
                              </span>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1 px-2.5 text-xs font-semibold rounded-lg text-primary hover:bg-primary/10"
                        onClick={() => handleShare(exec)}
                        title="Gerar foto para Story ou WhatsApp"
                      >
                        <Share2 className="h-3.5 w-3.5" />
                        <span className="hidden xs:inline">Foto</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg"
                        onClick={() => startEdit(exec)}
                        title="Editar feedback"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive rounded-lg"
                        onClick={() => {
                          if (confirm("Tem certeza que deseja apagar este registro?")) {
                            deleteMutation.mutate(exec.id);
                          }
                        }}
                        title="Excluir registro"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {editingId === exec.id ? (
                    <div className="space-y-2 mt-2 animate-in slide-in-from-top-1 duration-200">
                      <Textarea
                        value={editFeedback}
                        onChange={(e) => setEditFeedback(e.target.value)}
                        placeholder="Editar feedback do treino..."
                        className="text-xs min-h-[60px] rounded-xl"
                      />
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          <X className="h-3 w-3 mr-1" /> Cancelar
                        </Button>
                        <Button
                          size="sm"
                          onClick={() =>
                            updateMutation.mutate({ id: exec.id, feedback: editFeedback })
                          }
                        >
                          <Check className="h-3 w-3 mr-1" /> Salvar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    exec.feedback && (
                      <div className="text-[11px] text-muted-foreground italic bg-muted/30 p-2.5 rounded-lg border border-border/50 mt-1">
                        "{exec.feedback}"
                      </div>
                    )
                  )}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Janela de compartilhamento / Story do treino */}
      {selectedExec && (() => {
        let notes: any = {};
        try {
          notes = typeof selectedExec.notes === "string" ? JSON.parse(selectedExec.notes || "{}") : (selectedExec.notes || {});
        } catch {
          notes = {};
        }
        return (
          <WorkoutSummaryDialog
            open={summaryOpen}
            onOpenChange={setSummaryOpen}
            dayName={selectedExec.pt_training_days?.name || "Treino"}
            duration={notes.timerSeconds || 0}
            exercises={exercises}
            loads={notes.loads || {}}
            feedback={selectedExec.feedback || ""}
            executionId={selectedExec.id}
            initialExcludedExercises={notes.excludedExercises || []}
            completedSets={notes.completedSets}
            doneExercises={notes.doneExercises}
          />
        );
      })()}
    </>
  );
}
