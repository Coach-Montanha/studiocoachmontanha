import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Dumbbell,
  History,
  Target,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatDateBR } from "@/lib/format";
import { SessionTimer } from "@/components/pt/SessionTimer";

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

type ExecNotes = {
  loads?: Record<string, string>;
  doneExercises?: string[];
  timerSeconds?: number;
};

function parseNotes(raw: unknown): ExecNotes {
  if (!raw || typeof raw !== "string") return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as ExecNotes) : {};
  } catch {
    return {};
  }
}

function isSameDay(iso: string, ref: Date) {
  const d = new Date(iso);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

function PTTreinoPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);

  const { data: student, isLoading: loadingStudent } = useQuery({
    queryKey: ["pt-portal-treino", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("pt_students")
        .select("id,name,training_plan,user_id")
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

  const { data: executions = [] } = useQuery({
    queryKey: ["pt-portal-executions", student?.id],
    enabled: !!student?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("pt_training_executions" as never)
        .select("id,training_day_id,executed_at,notes")
        .eq("pt_student_id", student!.id)
        .order("executed_at", { ascending: false })
        .limit(200);
      return (data ?? []) as Array<{
        id: string;
        training_day_id: string;
        executed_at: string;
        notes: string | null;
      }>;
    },
  });

  const isLoading = loadingStudent || loadingPrograms;
  const selectedDay = days.find((d) => d.id === selectedDayId) ?? null;

  return (
    <div className="space-y-6">
      {!selectedDay && (
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Meu treino</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Rotinas montadas pelo seu Personal Trainer.
          </p>
        </div>
      )}

      {isLoading ? (
        <Card className="p-6">
          <p className="text-sm text-muted-foreground">Carregando…</p>
        </Card>
      ) : programs.length === 0 && !student?.training_plan ? (
        <Card className="p-6">
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ClipboardList className="h-6 w-6" />
            </div>
            <div>
              <div className="font-semibold">Nenhuma rotina publicada ainda</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Assim que seu Personal Trainer publicar sua rotina, ela aparecerá aqui.
              </p>
            </div>
          </div>
        </Card>
      ) : selectedDay ? (
        <FocusedDayView
          day={selectedDay}
          exercises={exercises.filter((e) => e.training_day_id === selectedDay.id)}
          executions={executions.filter((x) => x.training_day_id === selectedDay.id)}
          onBack={() => setSelectedDayId(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["pt-portal-executions", student?.id] });
            setSelectedDayId(null);
          }}
          studentId={student!.id}
          userId={student!.user_id}
        />
      ) : (
        <div className="space-y-6">
          {programs.map((p) => {
            const programDays = days.filter((d) => d.program_id === p.id);
            return (
              <Card key={p.id} className="space-y-5 p-5 sm:p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Dumbbell className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-semibold leading-tight tracking-tight">{p.name}</h2>
                    <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarDays className="h-3.5 w-3.5" />
                      <span>
                        {formatDateBR(p.start_date)}
                        {p.end_date ? ` — ${formatDateBR(p.end_date)}` : ""}
                      </span>
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">
                        {CATEGORY_LABELS[p.category] ?? p.category}
                      </span>
                      <span className="rounded-full bg-muted px-2.5 py-1 font-medium text-muted-foreground">
                        {LEVEL_LABELS[p.level] ?? p.level}
                      </span>
                    </div>
                  </div>
                </div>

                {p.goals && (
                  <div className="rounded-lg border bg-muted/40 p-3.5">
                    <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <Target className="h-3.5 w-3.5" /> Objetivos
                    </div>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{p.goals}</p>
                  </div>
                )}

                {programDays.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold">Treinos</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {programDays.map((d) => {
                        const count = exercises.filter((e) => e.training_day_id === d.id).length;
                        const doneToday = executions.some(
                          (x) => x.training_day_id === d.id && isSameDay(x.executed_at, new Date()),
                        );
                        const lastExec = executions.find((x) => x.training_day_id === d.id);
                        return (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => setSelectedDayId(d.id)}
                            className={cn(
                              "group relative flex flex-col gap-2 rounded-xl border bg-card p-4 text-left shadow-sm transition-all duration-200",
                              "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                              "active:translate-y-0",
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
                                {d.day_label}
                              </span>
                              {doneToday && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
                                  <CheckCircle2 className="h-3 w-3" /> Feito hoje
                                </span>
                              )}
                            </div>
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="text-base font-semibold leading-tight">{d.name}</span>
                              <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="tabular-nums">
                                {count} {count === 1 ? "exercício" : "exercícios"}
                              </span>
                              {lastExec && (
                                <span className="inline-flex items-center gap-1">
                                  <History className="h-3 w-3" />
                                  {formatDateBR(lastExec.executed_at)}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}

          {student?.training_plan && (
            <Card className="p-5 sm:p-6">
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

function FocusedDayView({
  day,
  exercises,
  executions,
  onBack,
  onSaved,
  studentId,
  userId,
}: {
  day: any;
  exercises: any[];
  executions: Array<{ id: string; training_day_id: string; executed_at: string; notes: string | null }>;
  onBack: () => void;
  onSaved: () => void;
  studentId: string;
  userId: string;
}) {
  const [loads, setLoads] = useState<Record<string, string>>({});
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const lastByExercise = useMemo(() => {
    const map: Record<string, { load: string; date: string }> = {};
    for (const exec of executions) {
      const n = parseNotes(exec.notes);
      if (!n.loads) continue;
      for (const [exId, load] of Object.entries(n.loads)) {
        if (!map[exId] && load) map[exId] = { load, date: exec.executed_at };
      }
    }
    return map;
  }, [executions]);

  const totalDone = Object.values(done).filter(Boolean).length;
  const progress = exercises.length > 0 ? Math.round((totalDone / exercises.length) * 100) : 0;

  async function handleComplete() {
    setSaving(true);
    try {
      const notes: ExecNotes = {
        loads: Object.fromEntries(Object.entries(loads).filter(([, v]) => v && v.trim())),
        doneExercises: Object.entries(done).filter(([, v]) => v).map(([k]) => k),
      };
      const { error } = await supabase.from("pt_training_executions" as never).insert({
        pt_student_id: studentId,
        training_day_id: day.id,
        user_id: userId,
        notes: JSON.stringify(notes),
      } as never);
      if (error) throw error;
      toast.success("Treino concluído — bom trabalho! 💪");
      onSaved();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 -mx-4 border-b bg-background/85 px-4 py-3 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 sm:-mx-6 sm:px-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="-ml-2 h-8 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                {day.day_label}
              </span>
              <span className="truncate text-sm font-semibold sm:text-base">{day.name}</span>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
                {totalDone}/{exercises.length}
              </span>
            </div>
          </div>
        </div>
        <div className="mt-3">
          <SessionTimer />
        </div>
      </div>

      {day.description && (
        <p className="whitespace-pre-wrap rounded-lg border bg-muted/40 p-3.5 text-sm leading-relaxed text-muted-foreground">
          {day.description}
        </p>
      )}

      {exercises.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted-foreground">Nenhum exercício neste treino ainda.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {exercises.map((ex, idx) => {
            const isDone = !!done[ex.id];
            const last = lastByExercise[ex.id];
            return (
              <div
                key={ex.id}
                className={cn(
                  "rounded-xl border bg-card p-4 shadow-sm transition-all duration-200",
                  isDone && "border-primary/40 bg-primary/[0.03]",
                )}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => setDone((d) => ({ ...d, [ex.id]: !d[ex.id] }))}
                    aria-label={isDone ? "Marcar como não feito" : "Marcar como feito"}
                    className={cn(
                      "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-all duration-200",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      isDone
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:border-primary/60",
                    )}
                  >
                    {isDone && <Check className="h-4 w-4" strokeWidth={3} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <h4
                        className={cn(
                          "text-base font-semibold leading-snug tracking-tight transition-all",
                          isDone && "text-muted-foreground line-through",
                        )}
                      >
                        {ex.name}
                      </h4>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      {ex.sets_reps && <span className="font-medium">{ex.sets_reps}</span>}
                      {ex.load && (
                        <>
                          {ex.sets_reps && <span className="text-border">·</span>}
                          <span>Sugerido: {ex.load}</span>
                        </>
                      )}
                      {ex.rest_seconds && (
                        <>
                          <span className="text-border">·</span>
                          <span className="tabular-nums">Descanso {ex.rest_seconds}s</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {ex.media_url && (
                  <div className="mt-3 overflow-hidden rounded-lg border">
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
                      <img
                        src={ex.media_url}
                        alt={ex.name}
                        loading="lazy"
                        className="aspect-video w-full object-cover"
                      />
                    )}
                  </div>
                )}

                <div className="mt-3 flex items-end gap-3">
                  <div className="flex-1">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Carga hoje
                    </label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="ex: 22.5 kg"
                      value={loads[ex.id] ?? ""}
                      onChange={(e) => setLoads((l) => ({ ...l, [ex.id]: e.target.value }))}
                      className="mt-1 h-10 tabular-nums"
                    />
                  </div>
                  {last && (
                    <div className="pb-1 text-right">
                      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        Última
                      </div>
                      <div className="text-sm font-semibold tabular-nums">{last.load}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {formatDateBR(last.date)}
                      </div>
                    </div>
                  )}
                </div>

                {ex.observations && (
                  <p className="mt-3 whitespace-pre-wrap rounded-md border-l-2 border-primary/40 bg-muted/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                    {ex.observations}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {exercises.length > 0 && (
        <div className="sticky bottom-0 z-10 -mx-4 border-t bg-background/85 px-4 py-3 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 sm:-mx-6 sm:px-6">
          <Button
            size="lg"
            onClick={handleComplete}
            disabled={saving}
            className="w-full gap-2 shadow-sm"
          >
            <CheckCircle2 className="h-5 w-5" />
            {saving ? "Salvando…" : "Concluir treino"}
          </Button>
        </div>
      )}
    </div>
  );
}

