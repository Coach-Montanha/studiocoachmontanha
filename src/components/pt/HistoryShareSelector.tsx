import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Share2, History as HistoryIcon, Trash2, Edit2, Check, X, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatDateBR } from "@/lib/format";
import { Textarea } from "@/components/ui/textarea";
import { WorkoutSummaryDialog } from "./WorkoutSummaryDialog";

export function HistoryShareSelector({ studentId }: { studentId: string }) {
  const [selectedExec, setSelectedExec] = useState<any>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
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

  if (isLoading) return <div className="text-xs text-muted-foreground animate-pulse">Carregando relatório...</div>;
  if (history.length === 0) return <div className="text-xs text-muted-foreground italic">Nenhum treino concluído no relatório.</div>;

  return (
    <div className="space-y-3">
      <div className="grid gap-3">
        {history.map((exec) => (
          <div key={exec.id} className="flex flex-col gap-2 rounded-xl border border-border bg-card/40 p-3 hover:bg-muted/30 transition-colors">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <ClipboardList className="h-4 w-4 text-primary shrink-0" />
                <div className="truncate">
                  <div className="text-sm font-bold truncate">{exec.pt_training_days?.name || "Treino"}</div>
                  <div className="text-[10px] text-muted-foreground">{formatDateBR(exec.executed_at)}</div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-muted-foreground hover:text-primary"
                  onClick={() => handleShare(exec)}
                >
                  <Share2 className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => startEdit(exec)}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    if (confirm("Tem certeza que deseja apagar este registro?")) {
                      deleteMutation.mutate(exec.id);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {editingId === exec.id ? (
              <div className="space-y-2 mt-1 animate-in slide-in-from-top-1 duration-200">
                <Textarea 
                  value={editFeedback}
                  onChange={(e) => setEditFeedback(e.target.value)}
                  placeholder="Editar feedback do treino..."
                  className="text-xs min-h-[60px]"
                />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                    <X className="h-3 w-3 mr-1" /> Cancelar
                  </Button>
                  <Button size="sm" onClick={() => updateMutation.mutate({ id: exec.id, feedback: editFeedback })}>
                    <Check className="h-3 w-3 mr-1" /> Salvar
                  </Button>
                </div>
              </div>
            ) : (
              exec.feedback && (
                <div className="text-[11px] text-muted-foreground italic bg-muted/20 p-2 rounded-lg border border-border/50">
                  "{exec.feedback}"
                </div>
              )
            )}
          </div>
        ))}
      </div>

      {selectedExec && (
        <WorkoutSummaryDialog
          open={summaryOpen}
          onOpenChange={setSummaryOpen}
          dayName={selectedExec.pt_training_days?.name || "Treino"}
          duration={(() => {
            try {
              const notes = typeof selectedExec.notes === 'string' ? JSON.parse(selectedExec.notes || "{}") : (selectedExec.notes || {});
              return notes.timerSeconds || 0;
            } catch {
              return 0;
            }
          })()}
          exercises={exercises}
          loads={(() => {
            try {
              const notes = typeof selectedExec.notes === 'string' ? JSON.parse(selectedExec.notes || "{}") : (selectedExec.notes || {});
              return notes.loads || {};
            } catch {
              return {};
            }
          })()}
          feedback={selectedExec.feedback || ""}
          executionId={selectedExec.id}
        />
      )}
    </div>
  );
}
