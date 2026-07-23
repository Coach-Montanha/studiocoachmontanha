import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Search, Plus, Video, Dumbbell, Library, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type LibraryExercise = {
  id: string;
  name: string;
  muscle_group: string | null;
  media_url: string | null;
  media_type: string | null;
  thumbnail_url: string | null;
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
        .select("id,name,muscle_group,media_url,media_type,thumbnail_url")
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

  async function addExercise(item?: LibraryExercise, fallbackName?: string) {
    setAdding(true);
    const name = item?.name ?? fallbackName ?? "";
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      setAdding(false);
      return;
    }
    const { error } = await supabase.from("pt_training_exercises" as never).insert({
      user_id: userId,
      training_day_id: trainingDayId,
      exercise_library_id: item?.id ?? null,
      name,
      // Reuse media from library so treinos herdam o vídeo de referência.
      media_url: item?.media_url ?? null,
      media_type: item?.media_type ?? null,
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
      .select("id,name,muscle_group,media_url,media_type,thumbnail_url")
      .single();
    await addExercise((newExercise as any) ?? undefined, customName.trim());
    setCustomName("");
    qc.invalidateQueries({ queryKey: ["exercise-library"] });
    qc.invalidateQueries({ queryKey: ["pt-library"] });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-hidden p-0">
        <div className="flex max-h-[90dvh] flex-col">
          <DialogHeader className="border-b border-border/60 p-5 pb-4">
            <DialogTitle>Adicionar exercício</DialogTitle>
            <DialogDescription className="text-xs">
              Selecione da biblioteca para reutilizar o vídeo de referência.
            </DialogDescription>
          </DialogHeader>

          <div className="border-b border-border/60 p-4">
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
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {filtered.length > 0 ? (
              <ul className="space-y-1.5">
                {filtered.map((exercise) => {
                  const thumb =
                    exercise.thumbnail_url ??
                    (exercise.media_url &&
                    /(?:youtube\.com|youtu\.be)/.test(exercise.media_url)
                      ? `https://img.youtube.com/vi/${
                          exercise.media_url.match(
                            /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/,
                          )?.[1]
                        }/hqdefault.jpg`
                      : null);
                  return (
                    <li key={exercise.id}>
                      <button
                        type="button"
                        onClick={() => addExercise(exercise)}
                        disabled={adding}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg border border-border/60 bg-card/40 p-2.5 text-left transition-all duration-200",
                          "hover:border-border hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          "disabled:cursor-not-allowed disabled:opacity-60",
                        )}
                      >
                        <div className="relative h-12 w-16 flex-shrink-0 overflow-hidden rounded-md bg-muted">
                          {thumb ? (
                            <img src={thumb} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <Dumbbell
                                className="h-5 w-5 text-muted-foreground/40"
                                strokeWidth={1.5}
                              />
                            </div>
                          )}
                          {exercise.media_url && (
                            <span className="absolute bottom-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-background/85 text-foreground shadow-sm">
                              <Video className="h-2.5 w-2.5" />
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{exercise.name}</div>
                          {exercise.muscle_group && (
                            <Badge
                              variant="secondary"
                              className="mt-1 h-4 px-1.5 text-[10px] font-normal"
                            >
                              {exercise.muscle_group}
                            </Badge>
                          )}
                        </div>
                        <Plus className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
                <Library className="mb-3 h-8 w-8 text-muted-foreground/50" strokeWidth={1.5} />
                <p className="text-sm text-muted-foreground">
                  {search
                    ? `Nenhum resultado para "${search}"`
                    : "Sua biblioteca ainda está vazia."}
                </p>
                <Link
                  to="/personal-trainer/biblioteca"
                  className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  Gerenciar biblioteca
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            )}
          </div>

          <div className="border-t border-border/60 bg-muted/30 p-4">
            <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Adicionar rápido
            </Label>
            <div className="mt-2 flex gap-2">
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
              <Button type="button" onClick={addCustomExercise} disabled={adding} size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Salvo na biblioteca automaticamente</span>
              <Link
                to="/personal-trainer/biblioteca"
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                <Library className="h-3 w-3" />
                Biblioteca completa
              </Link>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
