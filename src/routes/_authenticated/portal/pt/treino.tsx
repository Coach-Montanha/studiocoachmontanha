import { useMemo, useState } from "react";
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
  ArrowRightLeft,
  TrendingUp,
  Timer,
  EyeOff,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatDateBR } from "@/lib/format";
import { SessionTimer, formatSeconds } from "@/components/pt/SessionTimer";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useWakeLock } from "@/hooks/use-wake-lock";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WorkoutSummaryDialog } from "@/components/pt/WorkoutSummaryDialog";
import { WorkoutProgressionDialog } from "@/components/pt/WorkoutProgressionDialog";
import { RestCountdownTimer, parseSafeSeconds } from "@/components/pt/RestCountdownTimer";
import { ClinicalAlertBadge } from "@/components/pt/ClinicalAlertBadge";
import { getStudentAnamnesis, extractClinicalAlerts } from "@/lib/anamnesis";

function parseSetCount(setsReps?: string | null): number {
  if (!setsReps) return 3;
  const match = setsReps.match(/^(\d+)\s*[xX]/);
  if (match) {
    const num = parseInt(match[1], 10);
    if (!isNaN(num) && num > 0 && num <= 10) return num;
  }
  return 3;
}

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
  excludedExercises?: string[];
  completedSets?: Record<string, number[]>;
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

  // Mantém a tela ligada enquanto o aluno estiver visualizando um treino específico
  useWakeLock(!!selectedDayId);

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
  const [progressionOpen, setProgressionOpen] = useState(false);
  const [selectedProgressEx, setSelectedProgressEx] = useState<string | null>(null);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const selectedProgram = useMemo(
    () => programs.find((p) => p.id === selectedProgramId) ?? null,
    [programs, selectedProgramId]
  );

  const { data: anamnesis } = useQuery({
    queryKey: ["pt-portal-anamnesis", student?.id],
    enabled: !!student?.id,
    queryFn: () => getStudentAnamnesis(student!.id),
  });
  const clinicalAlerts = useMemo(() => extractClinicalAlerts(anamnesis), [anamnesis]);

  return (
    <div className="space-y-6">
      {clinicalAlerts.length > 0 && (
        <ClinicalAlertBadge
          alerts={clinicalAlerts}
          riskLevel={anamnesis?.risk_level}
        />
      )}

      {!selectedDay && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-title text-foreground">Treino Personal</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Rotinas montadas pelo seu Personal Trainer.
            </p>
          </div>
          {student && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 shadow-sm"
              onClick={() => {
                setSelectedProgressEx(null);
                setProgressionOpen(true);
              }}
            >
              <TrendingUp className="h-4 w-4 text-primary" />
              Evolução de Cargas
            </Button>
          )}
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
          onOpenProgression={(exName) => {
            setSelectedProgressEx(exName);
            setProgressionOpen(true);
          }}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["pt-portal-executions", student?.id] });
            setSelectedDayId(null);
          }}
          studentId={student!.id}
          userId={student!.user_id}
        />
      ) : (
        <div className="space-y-3">
          {programs.map((p) => {
            const programDays = days.filter((d) => d.program_id === p.id);
            const doneToday = programDays.some((d) =>
              executions.some(
                (x) => x.training_day_id === d.id && isSameDay(x.executed_at, new Date()),
              ),
            );
            const lastExec = executions.find((x) =>
              programDays.some((d) => d.id === x.training_day_id),
            );

            return (
              <Card
                key={p.id}
                onClick={() => setSelectedProgramId(p.id)}
                className={cn(
                  "group relative overflow-hidden rounded-2xl border bg-card p-4 sm:p-5 shadow-xs transition-all duration-200 cursor-pointer",
                  "hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md active:translate-y-0",
                  doneToday && "border-emerald-500/30 bg-emerald-500/5",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className={cn(
                        "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-all",
                        doneToday
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : "bg-primary/10 text-primary group-hover:scale-105 group-hover:bg-primary/15",
                      )}
                    >
                      <Dumbbell className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base sm:text-lg font-bold text-foreground leading-tight truncate">
                          {p.name}
                        </h2>
                        {doneToday && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" /> Feito hoje
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                          {formatDateBR(p.start_date)}
                        </span>
                        <span>•</span>
                        <span className="font-semibold text-foreground/80">
                          {programDays.length} {programDays.length === 1 ? "treino" : "treinos"}
                        </span>
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                          {CATEGORY_LABELS[p.category] ?? p.category}
                        </span>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {LEVEL_LABELS[p.level] ?? p.level}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="hidden sm:inline-flex gap-1.5 rounded-xl font-semibold text-primary group-hover:bg-primary/10 transition-colors"
                    >
                      <span>Abrir rotina</span>
                      <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </Button>
                    <div className="sm:hidden flex h-9 w-9 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-all">
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}

          {student?.training_plan && (
            <Card className="p-4 sm:p-5">
              <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Orientações Gerais do Personal
              </h3>
              <pre className="whitespace-pre-wrap break-words font-sans text-xs sm:text-sm leading-relaxed text-foreground">
{student.training_plan}
              </pre>
            </Card>
          )}
        </div>
      )}

      {/* Janela modal para exibição completa da rotina e seleção do treino do dia */}
      <Dialog
        open={!!selectedProgram}
        onOpenChange={(open) => {
          if (!open) setSelectedProgramId(null);
        }}
      >
        <DialogContent className="max-w-lg w-[95vw] sm:w-full max-h-[85vh] overflow-y-auto rounded-2xl p-5 sm:p-6 space-y-4">
          {selectedProgram && (() => {
            const programDays = days.filter((d) => d.program_id === selectedProgram.id);
            return (
              <>
                <DialogHeader className="space-y-1.5 text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary">
                      {CATEGORY_LABELS[selectedProgram.category] ?? selectedProgram.category}
                    </span>
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                      {LEVEL_LABELS[selectedProgram.level] ?? selectedProgram.level}
                    </span>
                  </div>
                  <DialogTitle className="text-xl font-bold leading-tight text-foreground">
                    {selectedProgram.name}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground flex flex-wrap items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" />
                    <span>
                      {formatDateBR(selectedProgram.start_date)}
                      {selectedProgram.end_date ? ` — ${formatDateBR(selectedProgram.end_date)}` : ""}
                    </span>
                    <span>•</span>
                    <span>{programDays.length} {programDays.length === 1 ? "sessão" : "sessões"} de treino</span>
                  </DialogDescription>
                </DialogHeader>

                {selectedProgram.goals && (
                  <div className="rounded-xl border border-border bg-muted/40 p-3.5 space-y-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      <Target className="h-3.5 w-3.5 text-primary" /> Objetivos do Treino
                    </div>
                    <p className="text-xs sm:text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                      {selectedProgram.goals}
                    </p>
                  </div>
                )}

                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Selecione o treino de hoje:
                    </h3>
                    <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">
                      {programDays.length} {programDays.length === 1 ? "opção" : "opções"}
                    </span>
                  </div>

                  <div className="grid gap-2.5">
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
                          onClick={() => {
                            setSelectedProgramId(null);
                            setSelectedDayId(d.id);
                          }}
                          className={cn(
                            "group relative flex flex-col gap-2 rounded-xl border bg-card p-3.5 sm:p-4 text-left shadow-xs transition-all duration-200",
                            "hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-sm active:translate-y-0",
                            doneToday && "border-emerald-500/30 bg-emerald-500/5",
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary">
                              {d.day_label}
                            </span>
                            {doneToday ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="h-3 w-3" /> Feito hoje
                              </span>
                            ) : lastExec ? (
                              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                <History className="h-3 w-3" />
                                {formatDateBR(lastExec.executed_at)}
                              </span>
                            ) : null}
                          </div>

                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-sm sm:text-base font-bold leading-tight group-hover:text-primary transition-colors">
                              {d.name}
                            </span>
                            <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary shrink-0" />
                          </div>

                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="tabular-nums">
                              {count} {count === 1 ? "exercício" : "exercícios"}
                            </span>
                            {lastExec?.notes && parseNotes(lastExec.notes).timerSeconds ? (
                              <span className="inline-flex items-center gap-1 text-[11px] opacity-75">
                                <Timer className="h-3 w-3" />
                                {formatSeconds(parseNotes(lastExec.notes).timerSeconds!)}
                              </span>
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {student && (
        <WorkoutProgressionDialog
          open={progressionOpen}
          onOpenChange={setProgressionOpen}
          studentId={student.id}
          initialExerciseName={selectedProgressEx}
        />
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
  onOpenProgression,
  studentId,
  userId,
}: {
  day: any;
  exercises: any[];
  executions: Array<{ id: string; training_day_id: string; executed_at: string; notes: string | null }>;
  onBack: () => void;
  onSaved: () => void;
  onOpenProgression?: (exName: string) => void;
  studentId: string;
  userId: string;
}) {
  const [loads, setLoads] = useState<Record<string, string>>({});
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeSubstitutes, setActiveSubstitutes] = useState<Record<string, string>>({}); // parentId -> substituteId
  const [excludedExerciseIds, setExcludedExerciseIds] = useState<string[]>([]);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [lastExecutionId, setLastExecutionId] = useState<string | undefined>(undefined);
  const [completedSets, setCompletedSets] = useState<Record<string, number[]>>({});
  const [restTimer, setRestTimer] = useState<{
    active: boolean;
    seconds: number;
    exerciseName: string;
    currentSet?: number;
    totalSets?: number;
  }>({
    active: false,
    seconds: 60,
    exerciseName: "",
  });

  const toggleExcludeFromSession = (exerciseId: string) => {
    setExcludedExerciseIds((prev) =>
      prev.includes(exerciseId)
        ? prev.filter((id) => id !== exerciseId)
        : [...prev, exerciseId]
    );
  };

  const toggleSet = (ex: any, setNum: number, totalSets: number) => {
    const current = completedSets[ex.id] || [];
    const isAlreadyDone = current.includes(setNum);
    const updated = isAlreadyDone
      ? current.filter((s) => s !== setNum)
      : [...current, setNum].sort((a, b) => a - b);

    setCompletedSets((prev) => ({ ...prev, [ex.id]: updated }));

    // Se concluiu a série agora, dispara o cronômetro de descanso automaticamente!
    if (!isAlreadyDone) {
      setRestTimer({
        active: true,
        seconds: parseSafeSeconds(ex.rest_seconds, 60),
        exerciseName: ex.name,
        currentSet: setNum,
        totalSets,
      });
    }

    // Se completou todas as séries, marca o exercício como concluído
    if (updated.length === totalSets) {
      setDone((d) => ({ ...d, [ex.id]: true }));
    } else if (isAlreadyDone && done[ex.id]) {
      setDone((d) => ({ ...d, [ex.id]: false }));
    }
  };

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

  const candidateExercises = useMemo(
    () => exercises.filter((e) => !e.substitute_exercise_id),
    [exercises]
  );

  const activeExercises = useMemo(
    () => candidateExercises.filter((e) => !excludedExerciseIds.includes(e.id)),
    [candidateExercises, excludedExerciseIds]
  );

  const totalDone = useMemo(() => {
    return activeExercises.filter((parentEx) => {
      const substitute = exercises.find((s) => s.substitute_exercise_id === parentEx.id);
      const isActiveSub = substitute && activeSubstitutes[parentEx.id] === substitute.id;
      const ex = isActiveSub && substitute ? substitute : parentEx;
      return !!done[ex.id];
    }).length;
  }, [activeExercises, exercises, activeSubstitutes, done]);

  const progress = activeExercises.length > 0 ? Math.round((totalDone / activeExercises.length) * 100) : 0;

  async function handleComplete() {
    setSaving(true);
    try {
      const performedExerciseIds = activeExercises
        .filter((parentEx) => {
          const substitute = exercises.find((s) => s.substitute_exercise_id === parentEx.id);
          const isActiveSub = substitute && activeSubstitutes[parentEx.id] === substitute.id;
          const ex = isActiveSub && substitute ? substitute : parentEx;
          const hasSets = (completedSets[ex.id] || []).length > 0;
          const isDone = !!done[ex.id];
          const hasLoad = !!(loads[ex.id] && loads[ex.id].trim());
          return hasSets || isDone || hasLoad;
        })
        .map((parentEx) => {
          const substitute = exercises.find((s) => s.substitute_exercise_id === parentEx.id);
          const isActiveSub = substitute && activeSubstitutes[parentEx.id] === substitute.id;
          const ex = isActiveSub && substitute ? substitute : parentEx;
          return ex.id;
        });

      const notes: ExecNotes = {
        loads: Object.fromEntries(Object.entries(loads).filter(([, v]) => v && v.trim())),
        doneExercises: performedExerciseIds,
        completedSets,
        timerSeconds,
        excludedExercises: excludedExerciseIds,
      };
      const { data: newExec, error } = await supabase.from("pt_training_executions" as any).insert({
        pt_student_id: studentId,
        training_day_id: day.id,
        user_id: userId,
        notes: JSON.stringify(notes),
        feedback: feedback.trim() || null,
      } as any).select("id").single();

      if (error) throw error;

      // Criar notificação para o treinador (o dono do registro do aluno)
      const { data: studentData } = await supabase
        .from("pt_students")
        .select("user_id, name")
        .eq("id", studentId)
        .single();

      if (studentData?.user_id) {
        await supabase.from("pt_notifications" as any).insert({
          user_id: studentData.user_id,
          title: "Novo treino concluído!",
          message: `${studentData.name} finalizou o treino "${day.name}"`,
          type: "training_complete",
          metadata: {
            student_id: studentId,
            execution_id: (newExec as any)?.id,
            day_name: day.name
          }
        });
      }

      setLastExecutionId((newExec as any)?.id);
      toast.success("Treino concluído — bom trabalho! 💪");
      setSummaryOpen(true);
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Sticky Header com Console do Treino e Cronômetro Gigante */}
      <div className="sticky top-16 z-30 -mx-3 sm:-mx-6 lg:-mx-8 px-3 sm:px-6 lg:px-8 py-3 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/85 border-b border-border/80 shadow-xs space-y-2.5">
        {/* Linha 1: Voltar + Badges de Status */}
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="-ml-1.5 h-8 gap-1.5 px-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>

          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary border border-primary/20">
              {day.day_label}
            </span>
            <span className="rounded-full bg-muted/80 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground border border-border/60">
              {totalDone}/{activeExercises.length} ({progress}%)
              {excludedExerciseIds.length > 0 && ` · ${excludedExerciseIds.length} pulado${excludedExerciseIds.length > 1 ? "s" : ""}`}
            </span>
          </div>
        </div>

        {/* Linha 2: Título completo do treino (sem corte) + barra de progresso */}
        <div className="space-y-1.5">
          <h2 className="text-base sm:text-lg font-bold text-foreground leading-snug break-words">
            {day.name}
          </h2>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Linha 3: Cronômetro gigante de alta visibilidade */}
        <SessionTimer
          variant="hero"
          seconds={timerSeconds}
          setSeconds={setTimerSeconds}
          running={timerRunning}
          setRunning={setTimerRunning}
          onReset={() => {
            setTimerSeconds(0);
            setTimerRunning(false);
          }}
        />
      </div>

      {day.description && (
        <div className="pt-2">
          <p className="whitespace-pre-wrap rounded-2xl border border-border/70 bg-muted/30 p-4 text-xs sm:text-sm leading-relaxed text-muted-foreground">
            {day.description}
          </p>
        </div>
      )}

      {exercises.length === 0 ? (
        <Card className="p-8 text-center rounded-2xl">
          <p className="text-sm text-muted-foreground">Nenhum exercício neste treino ainda.</p>
        </Card>
      ) : (
        <div className="space-y-3.5 pt-1">
          {exercises
            .filter((e) => !e.substitute_exercise_id)
            .map((parentEx, idx) => {
              const substitute = exercises.find((s) => s.substitute_exercise_id === parentEx.id);
              // Só permitimos a troca se o substituto realmente existir
              const isActiveSub = substitute && activeSubstitutes[parentEx.id] === substitute.id;
              const ex = isActiveSub && substitute ? substitute : parentEx;

              const isDone = !!done[ex.id];
              const last = lastByExercise[ex.id];
              const isExcluded = excludedExerciseIds.includes(parentEx.id);
              const totalSetsCount = parseSetCount(ex.sets_reps);

              if (isExcluded) {
                return (
                  <div
                    key={parentEx.id}
                    className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-dashed border-border/80 bg-muted/25 px-4 py-3 transition-all"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] font-bold text-muted-foreground shrink-0">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <EyeOff className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <span className="text-sm font-semibold text-muted-foreground line-through block truncate">
                          {ex.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground/80 block">
                          Excluído desta sessão (falta de tempo / equipamento indisponível)
                        </span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs font-semibold gap-1.5 px-3 rounded-xl shrink-0 hover:bg-primary/10 hover:text-primary"
                      onClick={() => toggleExcludeFromSession(parentEx.id)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Restaurar
                    </Button>
                  </div>
                );
              }

              return (
                <div
                  key={ex.id}
                  className={cn(
                    "relative overflow-hidden rounded-2xl border bg-card/95 p-4 sm:p-5 shadow-xs transition-all duration-200",
                    isDone
                      ? "border-emerald-500/40 bg-emerald-500/[0.03] ring-1 ring-emerald-500/20"
                      : "border-border/80 hover:border-primary/40",
                  )}
                >
                  {/* Linha superior: Checkbox grande + Numeração + Nome do exercício + Troca de substituto */}
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => setDone((d) => ({ ...d, [ex.id]: !d[ex.id] }))}
                      aria-label={isDone ? "Marcar como não concluído" : "Marcar como concluído"}
                      className={cn(
                        "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 transition-all duration-200 active:scale-95",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        isDone
                          ? "border-emerald-500 bg-emerald-500 text-white shadow-sm shadow-emerald-500/25"
                          : "border-border bg-background hover:border-primary/60 text-transparent hover:text-muted-foreground/30",
                      )}
                    >
                      <Check className={cn("h-5 w-5 transition-transform", isDone ? "scale-100" : "scale-75 opacity-0")} strokeWidth={3} />
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] font-bold text-muted-foreground">
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                        <h4
                          className={cn(
                            "text-base sm:text-lg font-bold leading-snug tracking-tight transition-all break-words",
                            isDone && "text-muted-foreground line-through",
                          )}
                        >
                          {ex.name}
                        </h4>
                        {isActiveSub && (
                          <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            Substituto
                          </span>
                        )}
                        {isDone && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                            Concluído
                          </span>
                        )}
                      </div>

                      {/* Chips modernos com parâmetros do exercício */}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 sm:gap-2">
                        {ex.series_type === "run" ? (
                          <>
                            {ex.load && (
                              <span className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                                <Target className="h-3.5 w-3.5 shrink-0" />
                                {ex.load}
                              </span>
                            )}
                            {ex.pace && (
                              <span className="inline-flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
                                Pace: {ex.pace}
                              </span>
                            )}
                          </>
                        ) : ex.series_type === "time_inclination" ? (
                          <>
                            {ex.time_seconds && (
                              <span className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                                <Timer className="h-3.5 w-3.5 shrink-0" />
                                {ex.time_seconds}s
                              </span>
                            )}
                            {ex.inclination && (
                              <span className="inline-flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
                                Inclinação: {ex.inclination}
                              </span>
                            )}
                          </>
                        ) : ex.series_type === "cadence" ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                            Cadência: {ex.cadence}
                          </span>
                        ) : (
                          <>
                            {ex.sets_reps && (
                              <span className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                                <Dumbbell className="h-3.5 w-3.5 shrink-0" />
                                {ex.sets_reps}
                              </span>
                            )}
                            {ex.load && (
                              <span className="inline-flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
                                <Target className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                Sugerido: {ex.load}
                              </span>
                            )}
                            {ex.time_seconds && (
                              <span className="inline-flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
                                <Timer className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                {ex.time_seconds}s
                              </span>
                            )}
                          </>
                        )}
                        {ex.rest_seconds && (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                            <Timer className="h-3.5 w-3.5 shrink-0" />
                            Descanso: {parseSafeSeconds(ex.rest_seconds, 60)}s
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {substitute && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "h-8 shrink-0 gap-1 px-2 text-xs font-semibold rounded-lg transition-colors",
                            isActiveSub
                              ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                          onClick={() =>
                            setActiveSubstitutes((prev) => ({
                              ...prev,
                              [parentEx.id]: isActiveSub ? "" : substitute.id,
                            }))
                          }
                          title={isActiveSub ? "Voltar ao exercício original" : "Trocar por exercício substituto"}
                        >
                          <ArrowRightLeft className="h-3.5 w-3.5 shrink-0" />
                          <span className="hidden sm:inline">{isActiveSub ? "Original" : "Substituir"}</span>
                        </Button>
                      )}

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 shrink-0 gap-1 px-2 text-xs font-semibold rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        onClick={() => toggleExcludeFromSession(parentEx.id)}
                        title="Excluir este exercício apenas desta sessão (falta de tempo, equipamento indisponível, etc.)"
                      >
                        <EyeOff className="h-3.5 w-3.5 shrink-0" />
                        <span className="hidden sm:inline">Pular</span>
                      </Button>
                    </div>
                  </div>

                  {/* Séries interativas com disparo automático do cronômetro de descanso */}
                  {ex.series_type !== "run" && (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/30 border border-border/60 p-2.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mr-1">
                          Séries:
                        </span>
                        {Array.from({ length: totalSetsCount }, (_, i) => i + 1).map((sNum) => {
                          const isSetDone = (completedSets[ex.id] || []).includes(sNum);
                          return (
                            <button
                              key={sNum}
                              type="button"
                              onClick={() => toggleSet(ex, sNum, totalSetsCount)}
                              className={cn(
                                "flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all active:scale-95",
                                isSetDone
                                  ? "bg-emerald-500 text-white shadow-xs shadow-emerald-500/25"
                                  : "border border-border/80 bg-background hover:border-primary/60 text-foreground/80",
                              )}
                              title={
                                isSetDone
                                  ? `Série ${sNum} concluída (clique para desmarcar)`
                                  : `Concluir série ${sNum} e iniciar descanso de ${parseSafeSeconds(ex.rest_seconds, 60)}s`
                              }
                            >
                              {isSetDone ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                              <span>S{sNum}</span>
                            </button>
                          );
                        })}
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setRestTimer({
                            active: true,
                            seconds: parseSafeSeconds(ex.rest_seconds, 60),
                            exerciseName: ex.name,
                            totalSets: totalSetsCount,
                          })
                        }
                        className="h-7 text-[11px] font-semibold gap-1 px-2 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 rounded-lg"
                        title="Iniciar cronômetro de descanso agora"
                      >
                        <Timer className="h-3.5 w-3.5" />
                        <span>Descansar ({parseSafeSeconds(ex.rest_seconds, 60)}s)</span>
                      </Button>
                    </div>
                  )}

                  {/* Demonstração em vídeo ou imagem */}
                  {ex.media_url && (
                    <div className="mt-3.5 overflow-hidden rounded-xl border border-border bg-black/5">
                      {ex.media_type === "youtube" ? (
                        <iframe
                          src={ex.media_url}
                          className="aspect-video w-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      ) : ex.media_type === "video" ? (
                        <video src={ex.media_url} controls className="max-h-72 sm:max-h-80 w-full object-contain rounded-xl bg-black/40" />
                      ) : (
                        <img
                          src={ex.media_url}
                          alt={ex.name}
                          loading="lazy"
                          className="max-h-72 sm:max-h-80 w-full object-contain rounded-xl bg-black/5"
                        />
                      )}
                    </div>
                  )}

                  {/* Registro de Carga com Atalho Prático de 1 Toque */}
                  <div className="mt-3.5 rounded-xl border border-border/70 bg-muted/20 p-3 sm:p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Carga realizada hoje
                      </label>
                      {onOpenProgression && (
                        <button
                          type="button"
                          onClick={() => onOpenProgression(ex.name)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                        >
                          <TrendingUp className="h-3.5 w-3.5" /> Ver evolução
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="ex: 22.5 kg"
                        value={loads[ex.id] ?? ""}
                        onChange={(e) => setLoads((l) => ({ ...l, [ex.id]: e.target.value }))}
                        className="h-11 flex-1 rounded-xl text-sm font-semibold tabular-nums bg-background border-border/80"
                      />
                      {last?.load && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setLoads((l) => ({ ...l, [ex.id]: last.load }))}
                          title={`Copiar última carga (${last.load})`}
                          className="h-11 shrink-0 gap-1.5 px-3 rounded-xl border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary font-semibold text-xs transition-all active:scale-95"
                        >
                          <ClipboardList className="h-3.5 w-3.5 shrink-0" />
                          <span className="hidden xs:inline">Usar última</span> ({last.load})
                        </Button>
                      )}
                    </div>

                    {last && (
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <History className="h-3 w-3 shrink-0" />
                        <span>
                          Última carga registrada: <strong className="text-foreground">{last.load}</strong> em {formatDateBR(last.date)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Observações / Orientações do Treinador */}
                  {ex.observations && (
                    <div className="mt-3 rounded-xl border-l-4 border-primary/70 bg-primary/5 p-3 text-xs leading-relaxed text-foreground/90">
                      <span className="font-bold text-primary block mb-0.5">Orientações do Coach:</span>
                      <span className="whitespace-pre-wrap break-words">{ex.observations}</span>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {exercises.length > 0 && (
        <div className="rounded-2xl border bg-card p-4 sm:p-5 shadow-xs space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Feedback do treino (opcional)
          </Label>
          <Textarea
            placeholder="Como foi o treino? Algum desconforto, RPE ou observação para o treinador?"
            className="min-h-[80px] rounded-xl text-sm resize-y"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
          />
        </div>
      )}

      {activeExercises.length > 0 && (
        <div className="sticky bottom-0 z-20 -mx-3 sm:-mx-6 lg:-mx-8 px-3 sm:px-6 lg:px-8 py-3.5 bg-background/90 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 border-t border-border/80 shadow-lg">
          <Button
            size="lg"
            onClick={handleComplete}
            disabled={saving}
            className={cn(
              "w-full h-12 gap-2 text-base font-bold rounded-xl shadow-md transition-all active:scale-[0.99]",
              totalDone === activeExercises.length && activeExercises.length > 0
                ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/25"
                : "shadow-primary/20",
            )}
          >
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            {saving
              ? "Salvando treino..."
              : totalDone === activeExercises.length
              ? `Finalizar treino completo (${totalDone}/${activeExercises.length})`
              : `Concluir treino (${totalDone}/${activeExercises.length} feitos)`}
          </Button>
        </div>
      )}

      <WorkoutSummaryDialog
        open={summaryOpen}
        onOpenChange={(open) => {
          setSummaryOpen(open);
          if (!open) {
            onSaved();
            setLastExecutionId(undefined);
          }
        }}
        dayName={day.name}
        duration={timerSeconds}
        exercises={exercises}
        loads={loads}
        feedback={feedback}
        executionId={lastExecutionId}
        initialExcludedExercises={excludedExerciseIds}
        onExcludedExercisesChange={setExcludedExerciseIds}
        completedSets={completedSets}
        doneExercises={done}
      />

      <RestCountdownTimer
        active={restTimer.active}
        initialSeconds={restTimer.seconds}
        exerciseName={restTimer.exerciseName}
        currentSet={restTimer.currentSet}
        totalSets={restTimer.totalSets}
        onDismiss={() => setRestTimer((t) => ({ ...t, active: false }))}
        onComplete={() => setRestTimer((t) => ({ ...t, active: false }))}
      />
    </div>
  );
}

