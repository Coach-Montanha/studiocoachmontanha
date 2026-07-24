import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarDays, Dumbbell, Target } from "lucide-react";
import { formatDateBR } from "@/lib/format";

const CATEGORY_LABELS: Record<string, string> = {
  hypertrophy: "Hipertrofia",
  conditioning: "Condicionamento físico",
  strength: "Força",
  cardio: "Cardio",
  general: "Geral",
};
const LEVEL_LABELS: Record<string, string> = {
  beginner: "Iniciante",
  intermediate: "Intermediário",
  advanced: "Avançado",
};

export function StudentViewDialog({
  open,
  onOpenChange,
  programId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  programId: string | null;
}) {
  const { data: program } = useQuery({
    queryKey: ["pt-program-preview", programId],
    enabled: !!programId && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("pt_programs" as never)
        .select("*")
        .eq("id", programId!)
        .maybeSingle();
      return data as any;
    },
  });

  const { data: days = [] } = useQuery({
    queryKey: ["pt-program-preview-days", programId],
    enabled: !!programId && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("pt_training_days" as never)
        .select("*")
        .eq("program_id", programId!)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      return (data ?? []) as any[];
    },
  });

  const dayIds = days.map((d) => d.id);
  const { data: exercises = [] } = useQuery({
    queryKey: ["pt-program-preview-ex", dayIds.join(",")],
    enabled: dayIds.length > 0 && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("pt_training_exercises" as never)
        .select("*")
        .in("training_day_id", dayIds)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      return (data ?? []) as any[];
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Visão do aluno</DialogTitle>
        </DialogHeader>
        {!program ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Dumbbell className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold">{program.name}</h2>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" />
                  <span>
                    {formatDateBR(program.start_date)}
                    {program.end_date ? ` — ${formatDateBR(program.end_date)}` : ""}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                    {CATEGORY_LABELS[program.category] ?? program.category}
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5 font-medium">
                    {LEVEL_LABELS[program.level] ?? program.level}
                  </span>
                </div>
              </div>
            </div>

            {program.goals && (
              <div className="rounded-lg border bg-background p-3">
                <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Target className="h-3.5 w-3.5" /> Objetivos
                </div>
                <p className="text-sm whitespace-pre-wrap">{program.goals}</p>
              </div>
            )}

            {!program.show_to_student && (
              <div className="rounded-md border border-state-pending/30 bg-state-pending-soft p-2 text-xs">
                ⚠️ Esta rotina está marcada como <b>não visível</b> ao aluno.
              </div>
            )}

            {days.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum treino cadastrado.</p>
            ) : (
              <div className="space-y-2">
                {days.map((d) => {
                  const dayExercises = exercises.filter((e) => e.training_day_id === d.id);
                  return (
                    <div key={d.id} className="rounded-lg border bg-background p-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{d.name}</span>
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          {d.day_label}
                        </span>
                      </div>
                      {d.description && (
                        <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                          {d.description}
                        </p>
                      )}
                      {dayExercises.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {dayExercises.map((ex) => (
                            <div key={ex.id} className="rounded-md border bg-muted/20 p-2">
                              <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <span className="font-medium text-sm">{ex.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {[
                                    ex.sets_reps,
                                    ex.load,
                                    ex.rest_seconds ? `${ex.rest_seconds}s` : null,
                                  ]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </span>
                              </div>
                              {ex.media_url && (
                                <div className="mt-2 overflow-hidden rounded">
                                  {ex.media_type === "youtube" ? (
                                    <iframe
                                      src={ex.media_url}
                                      className="aspect-video w-full"
                                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                      allowFullScreen
                                    />
                                  ) : ex.media_type === "video" ? (
                                    <video
                                      src={ex.media_url}
                                      controls
                                      className="aspect-video w-full object-cover"
                                    />
                                  ) : (
                                    <img
                                      src={ex.media_url}
                                      alt={ex.name}
                                      className="aspect-video w-full object-cover"
                                    />
                                  )}
                                </div>
                              )}
                              {ex.observations && (
                                <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                                  {ex.observations}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
