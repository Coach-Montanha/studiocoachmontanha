import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/edufinance/EmptyState";
import { TrendingUp, Dumbbell, Trophy, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { formatDateBR } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type ProgressionPoint = {
  date: string;
  displayDate: string;
  source: "execution" | "prescription";
  label: string;
  load: number;
  raw: string;
};

// Extracts numeric load from strings like "60kg", "12,5 kg", "80 x 3", "20/20"
function parseNumericLoad(s?: string | null): number | null {
  if (!s) return null;
  const cleaned = s.replace(",", ".").trim();
  const m = cleaned.match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

function parseExecutionNotes(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "string") return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && parsed.loads ? parsed.loads : {};
  } catch {
    return {};
  }
}

export function WorkoutProgressionDialog({
  open,
  onOpenChange,
  studentId,
  initialExerciseName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  studentId: string;
  initialExerciseName?: string | null;
}) {
  const [selectedExercise, setSelectedExercise] = useState<string>("");

  // 1. Fetch Prescribed Programs, Days, and Exercises
  const { data: programs = [] } = useQuery({
    queryKey: ["progression-programs", studentId],
    enabled: open && !!studentId,
    queryFn: async () => {
      const { data } = await supabase
        .from("pt_programs" as never)
        .select("id,name,start_date")
        .eq("pt_student_id", studentId)
        .order("start_date", { ascending: true });
      return (data ?? []) as Array<{ id: string; name: string; start_date: string }>;
    },
  });

  const programIds = programs.map((p) => p.id);
  const { data: days = [] } = useQuery({
    queryKey: ["progression-days", programIds.join(",")],
    enabled: open && programIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("pt_training_days" as never)
        .select("id,program_id,name,day_label")
        .in("program_id", programIds);
      return (data ?? []) as Array<{ id: string; program_id: string; name: string; day_label: string }>;
    },
  });

  const dayIds = days.map((d) => d.id);
  const { data: exercises = [] } = useQuery({
    queryKey: ["progression-exercises", dayIds.join(",")],
    enabled: open && dayIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("pt_training_exercises" as never)
        .select("id,name,load,training_day_id,created_at")
        .in("training_day_id", dayIds);
      return (data ?? []) as Array<{
        id: string;
        name: string;
        load: string | null;
        training_day_id: string;
        created_at: string;
      }>;
    },
  });

  // 2. Fetch Actual Executions (student logged loads)
  const { data: executions = [] } = useQuery({
    queryKey: ["progression-executions", studentId],
    enabled: open && !!studentId,
    queryFn: async () => {
      const { data } = await supabase
        .from("pt_training_executions" as never)
        .select("id,training_day_id,executed_at,notes")
        .eq("pt_student_id", studentId)
        .order("executed_at", { ascending: true });
      return (data ?? []) as Array<{
        id: string;
        training_day_id: string;
        executed_at: string;
        notes: string | null;
      }>;
    },
  });

  // 3. Aggregate and map all load data points by normalized exercise name
  const groupedExercises = useMemo(() => {
    const exerciseMap = new Map<string, { name: string; id: string; training_day_id: string }>();
    exercises.forEach((ex) => {
      exerciseMap.set(ex.id, ex);
    });

    const dayMap = new Map<string, { name: string; program_id: string }>();
    days.forEach((d) => dayMap.set(d.id, d));

    const programMap = new Map<string, { name: string; start_date: string }>();
    programs.forEach((p) => programMap.set(p.id, p));

    const byName = new Map<string, { name: string; points: ProgressionPoint[] }>();

    // A) Process Prescribed loads
    for (const ex of exercises) {
      const numeric = parseNumericLoad(ex.load);
      if (numeric == null) continue;
      const day = dayMap.get(ex.training_day_id);
      const prog = day ? programMap.get(day.program_id) : null;
      const date = prog?.start_date || ex.created_at.slice(0, 10);
      const key = ex.name.trim().toLowerCase();

      if (!byName.has(key)) {
        byName.set(key, { name: ex.name.trim(), points: [] });
      }

      byName.get(key)!.points.push({
        date,
        displayDate: formatDateBR(date),
        source: "prescription",
        label: prog ? `${prog.name} (Prescrito)` : "Prescrição",
        load: numeric,
        raw: ex.load ?? `${numeric}kg`,
      });
    }

    // B) Process Executed student loads (higher fidelity / actual performance)
    for (const exec of executions) {
      const execLoads = parseExecutionNotes(exec.notes);
      const date = exec.executed_at.slice(0, 10);
      const day = dayMap.get(exec.training_day_id);

      for (const [exId, rawLoad] of Object.entries(execLoads)) {
        const numeric = parseNumericLoad(rawLoad);
        if (numeric == null) continue;
        const ex = exerciseMap.get(exId);
        const exName = ex?.name?.trim() || "Exercício";
        const key = exName.toLowerCase();

        if (!byName.has(key)) {
          byName.set(key, { name: exName, points: [] });
        }

        byName.get(key)!.points.push({
          date,
          displayDate: formatDateBR(date),
          source: "execution",
          label: day ? `Treino: ${day.name}` : "Execução",
          load: numeric,
          raw: rawLoad,
        });
      }
    }

    // Sort points chronologically and clean duplicates on the same date/source
    for (const item of byName.values()) {
      item.points.sort((a, b) => a.date.localeCompare(b.date));
    }

    return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [exercises, executions, days, programs]);

  // Set initial selected exercise
  useEffect(() => {
    if (initialExerciseName) {
      const match = groupedExercises.find(
        (g) => g.name.toLowerCase() === initialExerciseName.trim().toLowerCase(),
      );
      if (match) {
        setSelectedExercise(match.name);
        return;
      }
    }
    if (groupedExercises.length > 0 && (!selectedExercise || !groupedExercises.some((g) => g.name === selectedExercise))) {
      setSelectedExercise(groupedExercises[0].name);
    }
  }, [groupedExercises, initialExerciseName, selectedExercise]);

  const currentExercise = groupedExercises.find((g) => g.name === selectedExercise) ?? groupedExercises[0] ?? null;

  // Stats calculation
  const stats = useMemo(() => {
    if (!currentExercise || currentExercise.points.length === 0) return null;
    const pts = currentExercise.points;
    const firstLoad = pts[0].load;
    const currentLoad = pts[pts.length - 1].load;
    const maxLoad = Math.max(...pts.map((p) => p.load));
    const totalGain = currentLoad - firstLoad;
    const percentGain = firstLoad > 0 ? (totalGain / firstLoad) * 100 : 0;
    return {
      initial: firstLoad,
      current: currentLoad,
      max: maxLoad,
      gain: totalGain,
      percent: percentGain,
      count: pts.length,
    };
  }, [currentExercise]);

  const chartData = useMemo(() => {
    if (!currentExercise) return [];
    return currentExercise.points.map((p, idx) => ({
      idx,
      date: p.displayDate,
      load: p.load,
      raw: p.raw,
      label: p.label,
      source: p.source,
    }));
  }, [currentExercise]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Evolução de Cargas</DialogTitle>
              <DialogDescription className="text-xs">
                Acompanhe a progressão de força e sobrecarga progressiva ao longo dos treinos.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {groupedExercises.length === 0 ? (
          <EmptyState
            icon={<Dumbbell className="h-6 w-6" />}
            title="Nenhuma carga registrada"
            description="Ao registrar as cargas durante os treinos no portal (ex: 50kg), o gráfico de evolução histórica será gerado automaticamente."
          />
        ) : (
          <div className="space-y-5 pt-2">
            {/* Exercise Selector */}
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Selecione o Exercício
              </label>
              <Select value={selectedExercise} onValueChange={setSelectedExercise}>
                <SelectTrigger className="w-full sm:w-[280px]">
                  <SelectValue placeholder="Escolha um exercício" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {groupedExercises.map((g) => (
                    <SelectItem key={g.name} value={g.name}>
                      <span className="font-medium">{g.name}</span>{" "}
                      <span className="text-xs text-muted-foreground">({g.points.length} registros)</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quick KPI Stat Cards */}
            {stats && (
              <div className="grid grid-cols-3 gap-3">
                <Card className="p-3 bg-muted/30">
                  <div className="text-[11px] font-medium text-muted-foreground">Carga Inicial</div>
                  <div className="mt-1 text-lg font-bold font-mono">{stats.initial} kg</div>
                </Card>
                <Card className="p-3 bg-muted/30">
                  <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                    <Trophy className="h-3 w-3 text-amber-500" /> Recorde (PR)
                  </div>
                  <div className="mt-1 text-lg font-bold font-mono text-amber-600 dark:text-amber-400">
                    {stats.max} kg
                  </div>
                </Card>
                <Card className="p-3 bg-muted/30">
                  <div className="text-[11px] font-medium text-muted-foreground">Progresso Total</div>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span
                      className={`text-lg font-bold font-mono ${
                        stats.gain >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                      }`}
                    >
                      {stats.gain > 0 ? `+${stats.gain}` : stats.gain} kg
                    </span>
                    {stats.gain !== 0 && (
                      <span className="text-[11px] text-muted-foreground">
                        ({stats.percent > 0 ? `+${stats.percent.toFixed(0)}%` : `${stats.percent.toFixed(0)}%`})
                      </span>
                    )}
                  </div>
                </Card>
              </div>
            )}

            {/* Recharts Line Chart */}
            {chartData.length > 0 && (
              <div className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">Linha do Tempo de Cargas</span>
                  <Badge variant="outline" className="text-[10px]">
                    {chartData.length} sessões registradas
                  </Badge>
                </div>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 15, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
                      <YAxis tick={{ fontSize: 11 }} tickLine={false} unit="kg" />
                      <Tooltip
                        formatter={(val: number) => [`${val} kg`, "Carga executada"]}
                        labelFormatter={(_label, payload) => {
                          const item = payload?.[0]?.payload;
                          return item ? `${item.date} — ${item.label}` : "";
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="load"
                        stroke="var(--color-primary)"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: "var(--color-primary)" }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Historical Table with Deltas */}
            {currentExercise && currentExercise.points.length > 0 && (
              <div className="rounded-xl border overflow-hidden">
                <div className="bg-muted/40 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b">
                  Histórico de Registros
                </div>
                <div className="max-h-48 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/20 text-muted-foreground sticky top-0">
                      <tr>
                        <th className="p-2.5 text-left font-medium">Data</th>
                        <th className="p-2.5 text-left font-medium">Origem</th>
                        <th className="p-2.5 text-left font-medium">Anotação</th>
                        <th className="p-2.5 text-right font-medium">Carga (kg)</th>
                        <th className="p-2.5 text-right font-medium">Evolução</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {currentExercise.points.map((p, i) => {
                        const prev = i > 0 ? currentExercise.points[i - 1].load : null;
                        const delta = prev != null ? p.load - prev : null;
                        return (
                          <tr key={i} className="hover:bg-muted/30 transition-colors">
                            <td className="p-2.5 font-mono">{p.displayDate}</td>
                            <td className="p-2.5 text-muted-foreground truncate max-w-[140px]">{p.label}</td>
                            <td className="p-2.5 text-muted-foreground font-mono">{p.raw}</td>
                            <td className="p-2.5 text-right font-mono font-semibold">{p.load} kg</td>
                            <td className="p-2.5 text-right font-mono">
                              {delta != null && delta !== 0 ? (
                                <span
                                  className={`inline-flex items-center gap-0.5 font-semibold ${
                                    delta > 0
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : "text-destructive"
                                  }`}
                                >
                                  {delta > 0 ? (
                                    <>
                                      <ArrowUpRight className="h-3 w-3" /> +{delta}
                                    </>
                                  ) : (
                                    <>
                                      <ArrowDownRight className="h-3 w-3" /> {delta}
                                    </>
                                  )}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
