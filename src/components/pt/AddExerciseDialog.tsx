import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Plus } from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

type LibraryExercise = {
  id: string;
  name: string;
  muscle_group: string | null;
};

export function AddExerciseDialog({
  open,
  onOpenChange,
  trainingDayId,
  currentCount,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  trainingDayId: string;
  currentCount: number;
}) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [customName, setCustomName] = useState("");
  const [adding, setAdding] = useState(false);

  const { data: library = [] } = useQuery({
    queryKey: ["exercise-library"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pt_exercises_library" as never)
        .select("id,name,muscle_group")
        .order("name");
      return (data ?? []) as unknown as LibraryExercise[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return library.filter(
      (e) =>
        !q ||
        e.name.toLowerCase().includes(q) ||
        (e.muscle_group ?? "").toLowerCase().includes(q),
    );
  }, [library, search]);

  async function addExercise(name: string, libraryId?: string) {
    setAdding(true);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      setAdding(false);
      return;
    }
    const { error } = await supabase.from("pt_training_exercises" as never).insert({
      user_id: userId,
      training_day_id: trainingDayId,
      exercise_library_id: libraryId ?? null,
      name,
      sort_order: currentCount,
    } as never);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`"${name}" adicionado`);
      qc.invalidateQueries({ queryKey: ["pt-day-exercises", trainingDayId] });
      onOpenChange(false);
    }
    setAdding(false);
  }

  async function addCustomExercise() {
    if (!customName.trim()) {
      toast.error("Digite o nome do exercício.");
      return;
    }
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;
    const { data: newExercise } = await supabase
      .from("pt_exercises_library" as never)
      .insert({ user_id: userId, name: customName.trim() } as never)
      .select("id")
      .single();
    await addExercise(customName.trim(), (newExercise as any)?.id);
    setCustomName("");
    qc.invalidateQueries({ queryKey: ["exercise-library"] });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar exercício</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar exercício…"
            autoFocus
            className="pl-9"
          />
        </div>

        <div className="max-h-64 space-y-1 overflow-y-auto">
          {filtered.map((exercise) => (
            <button
              key={exercise.id}
              type="button"
              onClick={() => addExercise(exercise.name, exercise.id)}
              disabled={adding}
              className="flex w-full items-center justify-between rounded-lg border p-3 text-left text-sm transition-colors hover:bg-accent"
            >
              <div>
                <div className="font-medium">{exercise.name}</div>
                {exercise.muscle_group && (
                  <div className="text-xs text-muted-foreground">{exercise.muscle_group}</div>
                )}
              </div>
              <Plus className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
          {filtered.length === 0 && search && (
            <p className="p-4 text-center text-sm text-muted-foreground">
              Nenhum exercício encontrado para "{search}"
            </p>
          )}
          {library.length === 0 && !search && (
            <p className="p-4 text-center text-sm text-muted-foreground">
              Sua biblioteca ainda está vazia. Crie seu primeiro exercício abaixo.
            </p>
          )}
        </div>

        <div className="space-y-2 border-t pt-3">
          <Label className="text-xs">Criar exercício personalizado</Label>
          <div className="flex gap-2">
            <Input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Nome do exercício…"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustomExercise();
                }
              }}
            />
            <Button type="button" onClick={addCustomExercise} disabled={adding}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
