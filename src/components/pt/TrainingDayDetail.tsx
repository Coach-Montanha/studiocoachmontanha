import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { confirmDialog } from "@/lib/confirm-dialog";
import { ExerciseCard, type TrainingExercise } from "./ExerciseCard";
import { AddExerciseDialog } from "./AddExerciseDialog";

export function TrainingDayDetail({ dayId }: { dayId: string }) {
  const [addOpen, setAddOpen] = useState(false);
  const [allExpanded, setAllExpanded] = useState(true);

  const { data: exercises = [], refetch } = useQuery({
    queryKey: ["pt-day-exercises", dayId],
    queryFn: async () => {
      const { data } = await supabase
        .from("pt_training_exercises" as never)
        .select("*")
        .eq("training_day_id", dayId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      return (data ?? []) as unknown as TrainingExercise[];
    },
  });

  async function deleteExercise(id: string) {
    if (!(await confirmDialog("Excluir este exercício?"))) return;
    const { error } = await supabase
      .from("pt_training_exercises" as never)
      .delete()
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Exercício removido");
    refetch();
  }

  return (
    <div className="space-y-3 border-t pt-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Exercícios</h4>
        {exercises.length > 0 && (
          <button
            type="button"
            onClick={() => setAllExpanded((v) => !v)}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            {allExpanded ? "Recolher todos" : "Expandir todos"}
            {allExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        )}
      </div>

      {exercises.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-6 text-center">
          <p className="text-sm text-muted-foreground">Nenhum exercício adicionado ainda</p>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Adicionar primeiro exercício
          </Button>
        </div>
      ) : (
        <div key={String(allExpanded)} className="space-y-2">
          {exercises.map((exercise) => (
            <ExerciseCard
              key={exercise.id}
              exercise={exercise}
              trainingDayId={dayId}
              onDelete={deleteExercise}
              onUpdate={refetch}
            />
          ))}
        </div>
      )}

      {exercises.length > 0 && (
        <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> Adicionar exercício
        </Button>
      )}

      <AddExerciseDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        trainingDayId={dayId}
        currentCount={exercises.length}
      />
    </div>
  );
}
