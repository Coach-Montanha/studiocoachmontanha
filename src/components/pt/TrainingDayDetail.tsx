import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, ChevronUp, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { confirmDialog } from "@/lib/confirm-dialog";
import { DragHandle, SortableList } from "@/components/ui-kit/SortableList";
import { ExerciseCard, type TrainingExercise } from "./ExerciseCard";
import { AddExerciseDialog } from "./AddExerciseDialog";

export function TrainingDayDetail({ dayId }: { dayId: string }) {
  const [addOpen, setAddOpen] = useState(false);
  const [substituteForId, setSubstituteForId] = useState<string | null>(null);
  const [allExpanded, setAllExpanded] = useState(true);
  const [order, setOrder] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);

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

  // ordem otimista enquanto o servidor não confirma
  const ordered = order
    ? (order.map((id) => exercises.find((e) => e.id === id)).filter(Boolean) as TrainingExercise[])
    : exercises;
  const list = ordered.length === exercises.length ? ordered : exercises;

  async function reorder(ids: string[]) {
    setOrder(ids);
    setSaving(true);
    const results = await Promise.all(
      ids.map((id, i) =>
        supabase
          .from("pt_training_exercises" as never)
          .update({ sort_order: i } as never)
          .eq("id", id),
      ),
    );
    setSaving(false);
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      setOrder(null);
      toast.error(failed.error.message);
      return;
    }
    await refetch();
    setOrder(null);
  }

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
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h4 className="text-sm font-semibold leading-tight">Exercícios</h4>
          {saving && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> salvando ordem
            </span>
          )}
        </div>
        {exercises.length > 0 && (
          <button
            type="button"
            onClick={() => setAllExpanded((v) => !v)}
            className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-primary outline-none transition-colors duration-150 hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-card"
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
        <SortableList
          items={list}
          onReorder={reorder}
          disabled={saving}
          className="space-y-2"
        >
          {(exercise, { handleProps }) => (
            <div key={exercise.id} className="space-y-2">
              <ExerciseCard
                exercise={exercise}
                trainingDayId={dayId}
                onDelete={deleteExercise}
                onUpdate={refetch}
                initialExpanded={allExpanded}
                dragHandle={<DragHandle handleProps={handleProps} label={`Reordenar ${exercise.name}`} />}
                onSelectSubstitute={(id) => {
                  // This will be handled by a new state in TrainingDayDetail
                  setSubstituteForId(id);
                  setAddOpen(true);
                }}
              />
              {exercises
                .filter((sub) => sub.substitute_exercise_id === exercise.id)
                .map((sub) => (
                  <div key={sub.id} className="ml-6 border-l-2 border-primary/20 pl-4">
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-primary/60">
                      Exercício Substituto
                    </div>
                    <ExerciseCard
                      exercise={sub}
                      trainingDayId={dayId}
                      onDelete={deleteExercise}
                      onUpdate={refetch}
                      initialExpanded={allExpanded}
                      isSubstitute
                      dragHandle={null}
                    />
                  </div>
                ))}
            </div>
          )}
        </SortableList>
      )}

      {exercises.length > 0 && (
        <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> Adicionar exercício
        </Button>
      )}

      <AddExerciseDialog
        open={addOpen}
        trainingDayId={dayId}
        currentCount={exercises.length}
        substituteForId={substituteForId}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) setSubstituteForId(null);
        }}
      />
    </div>
  );
}
