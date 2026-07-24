import { useMemo, useState } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/edufinance/EmptyState";
import { TrendingUp } from "lucide-react";
import { formatDateBR } from "@/lib/format";

type ExerciseRow = {
  id: string;
  name: string;
  load: string | null;
  training_day_id: string;
  created_at: string;
};

type DayRow = { id: string; program_id: string; name: string };
type ProgramRow = { id: string; name: string; start_date: string };

// Extract a numeric value from a load string like "60kg", "12,5 kg", "80 x 3".
function parseLoad(s?: string | null): number | null {
  if (!s) return null;
  const m = s.replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

export function LoadProgressionDialog({
  open,
  onOpenChange,
  studentId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  studentId: string;
}) {
  const [selected, setSelected] = useState<string>("");

  const { data: programs = [] } = useQuery({
    queryKey: ["pt-progress-programs", studentId],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("pt_programs" as never)
        .select("id,name,start_date")
        .eq("pt_student_id", studentId)
        .eq("is_deleted", false)
        .order("start_date", { ascending: true });
      return (data ?? []) as unknown as ProgramRow[];
    },
  });

  const programIds = programs.map((p) => p.id);
  const { data: days = [] } = useQuery({
    queryKey: ["pt-progress-days", programIds.join(",")],
    enabled: open && programIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("pt_training_days" as never)
        .select("id,program_id,name")
        .in("program_id", programIds);
      return (data ?? []) as unknown as DayRow[];
    },
  });

  const dayIds = days.map((d) => d.id);
  const { data: exercises = [] } = useQuery({
    queryKey: ["pt-progress-ex", dayIds.join(",")],
    enabled: open && dayIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("pt_training_exercises" as never)
        .select("id,name,load,training_day_id,created_at")
        .in("training_day_id", dayIds);
      return (data ?? []) as unknown as ExerciseRow[];
    },
  });

  // Group exercises by normalized name.
  const grouped = useMemo(() => {
    const dayToProgram = new Map(days.map((d) => [d.id, d.program_id]));
    const programById = new Map(programs.map((p) => [p.id, p]));
    const byName = new Map<
      string,
      { name: string; points: { date: string; label: string; load: number; raw: string }[] }
    >();
    for (const ex of exercises) {
      const load = parseLoad(ex.load);
      if (load == null) continue;
      const programId = dayToProgram.get(ex.training_day_id);
      const program = programId ? programById.get(programId) : null;
      if (!program) continue;
      const key = ex.name.trim().toLowerCase();
      if (!byName.has(key)) byName.set(key, { name: ex.name.trim(), points: [] });
      byName.get(key)!.points.push({
        date: program.start_date,
        label: `${program.name} (${formatDateBR(program.start_date)})`,
        load,
        raw: ex.load ?? "",
      });
    }
    for (const g of byName.values()) {
      g.points.sort((a, b) => a.date.localeCompare(b.date));
    }
    return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [exercises, days, programs]);

  const options = grouped.filter((g) => g.points.length >= 1);
  const currentKey = selected || options[0]?.name || "";
  const current = options.find((g) => g.name === currentKey) ?? null;

  const chartData = current?.points.map((p, i) => ({
    idx: i,
    label: p.label,
    date: formatDateBR(p.date),
    load: p.load,
    raw: p.raw,
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Evolução de cargas</DialogTitle>
        </DialogHeader>
        {options.length === 0 ? (
          <EmptyState
            icon={<TrendingUp className="h-6 w-6" />}
            title="Sem cargas registradas"
            description="Adicione o campo 'Carga' em pelo menos um exercício com valor numérico (ex: 60kg) para ver a progressão."
          />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Exercício:</span>
              <Select value={currentKey} onValueChange={setSelected}>
                <SelectTrigger className="max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.map((o) => (
                    <SelectItem key={o.name} value={o.name}>
                      {o.name} ({o.points.length} registros)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {current && chartData && (
              <>
                <div className="h-64 w-full rounded-lg border bg-muted/10 p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(v: number) => [`${v}`, "Carga"]}
                        labelFormatter={(_l, payload) => (payload?.[0]?.payload as any)?.label ?? ""}
                      />
                      <Line
                        type="monotone"
                        dataKey="load"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="p-2 text-left">Rotina</th>
                        <th className="p-2 text-left">Carga registrada</th>
                        <th className="p-2 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {current.points.map((p, i) => {
                        const prev = i > 0 ? current.points[i - 1].load : null;
                        const delta = prev != null ? p.load - prev : null;
                        return (
                          <tr key={i} className="border-t">
                            <td className="p-2">{p.label}</td>
                            <td className="p-2 text-muted-foreground">{p.raw}</td>
                            <td className="p-2 text-right font-medium">
                              {p.load}
                              {delta != null && delta !== 0 && (
                                <span
                                  className={`ml-2 text-xs ${delta > 0 ? "text-state-paid" : "text-destructive"}`}
                                >
                                  {delta > 0 ? "▲" : "▼"} {Math.abs(delta)}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
