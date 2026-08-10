import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Share2, History as HistoryIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { formatDateBR } from "@/lib/format";
import { WorkoutSummaryDialog } from "./WorkoutSummaryDialog";

export function HistoryShareSelector({ studentId }: { studentId: string }) {
  const [selectedExec, setSelectedExec] = useState<any>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);

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
          pt_training_days (
            name,
            program_id
          )
        `)
        .eq("pt_student_id", studentId)
        .order("executed_at", { ascending: false })
        .limit(10);
      return (data ?? []) as any[];
    },
  });

  // Precisamos buscar os exercícios para o dia selecionado
  const { data: exercises = [] } = useQuery({
    queryKey: ["pt-history-exercises", selectedExec?.pt_training_days?.program_id],
    enabled: !!selectedExec?.pt_training_days?.program_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("pt_training_exercises" as any)
        .select("*")
        .eq("program_id", selectedExec.pt_training_days.program_id)
        .order("sort_order", { ascending: true });
      return (data ?? []) as any[];
    },
  });

  const handleShare = (exec: any) => {
    setSelectedExec(exec);
    setSummaryOpen(true);
  };

  if (isLoading) return <div className="text-xs text-muted-foreground animate-pulse">Carregando histórico...</div>;
  if (history.length === 0) return <div className="text-xs text-muted-foreground italic">Nenhum treino concluído para compartilhar.</div>;

  return (
    <div className="space-y-2">
      <div className="grid gap-2">
        {history.map((exec) => (
          <Button
            key={exec.id}
            variant="outline"
            size="sm"
            className="w-full justify-between text-left font-normal"
            onClick={() => handleShare(exec)}
          >
            <div className="flex items-center gap-2 truncate">
              <HistoryIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div className="truncate">
                <span className="font-medium">{exec.pt_training_days?.name || "Treino"}</span>
                <span className="ml-2 text-[10px] text-muted-foreground">{formatDateBR(exec.executed_at)}</span>
              </div>
            </div>
            <Share2 className="h-3.5 w-3.5 text-primary shrink-0" />
          </Button>
        ))}
      </div>

      {selectedExec && (
        <WorkoutSummaryDialog
          open={summaryOpen}
          onOpenChange={setSummaryOpen}
          dayName={selectedExec.pt_training_days?.name || "Treino"}
          duration={(() => {
            try {
              return JSON.parse(selectedExec.notes || "{}").timerSeconds || 0;
            } catch {
              return 0;
            }
          })()}
          exercises={exercises}
          loads={(() => {
            try {
              return JSON.parse(selectedExec.notes || "{}").loads || {};
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
