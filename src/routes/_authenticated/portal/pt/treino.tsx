import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { ClipboardList, CalendarDays, Target, Dumbbell } from "lucide-react";
import { formatDateBR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/portal/pt/treino")({
  head: () => ({ meta: [{ title: "Meu treino — Personal Trainer" }] }),
  component: PTTreinoPage,
});

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

function PTTreinoPage() {
  const { user } = useAuth();

  const { data: student, isLoading: loadingStudent } = useQuery({
    queryKey: ["pt-portal-treino", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("pt_students")
        .select("id,name,training_plan")
        .eq("account_user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: programs = [], isLoading: loadingPrograms } = useQuery({
    queryKey: ["pt-portal-programs", student?.id],
    enabled: !!student?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("pt_programs" as never)
        .select("*")
        .eq("pt_student_id", student!.id)
        .order("start_date", { ascending: false });
      return (data ?? []) as any[];
    },
  });

  const programIds = programs.map((p) => p.id);
  const { data: days = [] } = useQuery({
    queryKey: ["pt-portal-days", programIds.join(",")],
    enabled: programIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("pt_training_days" as never)
        .select("*")
        .in("program_id", programIds)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      return (data ?? []) as any[];
    },
  });

  const dayIds = days.map((d) => d.id);
  const { data: exercises = [] } = useQuery({
    queryKey: ["pt-portal-exercises", dayIds.join(",")],
    enabled: dayIds.length > 0,
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

  const isLoading = loadingStudent || loadingPrograms;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Meu treino</h1>
        <p className="text-sm text-muted-foreground">Rotinas montadas pelo seu Personal Trainer.</p>
      </div>

      {isLoading ? (
        <Card className="p-5"><p className="text-sm text-muted-foreground">Carregando…</p></Card>
      ) : programs.length === 0 && !student?.training_plan ? (
        <Card className="p-5">
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ClipboardList className="h-6 w-6" />
            </div>
            <div>
              <div className="font-semibold">Nenhuma rotina publicada ainda</div>
              <p className="text-sm text-muted-foreground mt-1">
                Assim que seu Personal Trainer publicar sua rotina, ela aparecerá aqui.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {programs.map((p) => {
            const programDays = days.filter((d) => d.program_id === p.id);
            return (
              <Card key={p.id} className="p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Dumbbell className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold">{p.name}</h2>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" />
                      <span>
                        {formatDateBR(p.start_date)}
                        {p.end_date ? ` — ${formatDateBR(p.end_date)}` : ""}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                        {CATEGORY_LABELS[p.category] ?? p.category}
                      </span>
                      <span className="rounded-full bg-muted px-2 py-0.5 font-medium">
                        {LEVEL_LABELS[p.level] ?? p.level}
                      </span>
                    </div>
                  </div>
                </div>

                {p.goals && (
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <Target className="h-3.5 w-3.5" /> Objetivos
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{p.goals}</p>
                  </div>
                )}

                {programDays.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Treinos</h3>
                    {programDays.map((d) => {
                      const dayExercises = exercises.filter((e) => e.training_day_id === d.id);
                      return (
                        <div key={d.id} className="rounded-lg border p-3">
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
                                      {[ex.sets_reps, ex.load, ex.rest_seconds ? `${ex.rest_seconds}s` : null]
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
                                        <video src={ex.media_url} controls className="aspect-video w-full object-cover" />
                                      ) : (
                                        <img src={ex.media_url} alt={ex.name} className="aspect-video w-full object-cover" />
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
              </Card>
            );
          })}

          {student?.training_plan && (
            <Card className="p-5">
              <h3 className="mb-2 text-sm font-semibold">Anotações do trainer</h3>
              <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-foreground">
{student.training_plan}
              </pre>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
