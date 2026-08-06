import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { prescribeTrainingWithAi, type AiPrescription } from "@/lib/pt-ai.functions";

export function AiPrescribeDialog({
  open,
  onOpenChange,
  programId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  programId: string | null;
}) {
  const qc = useQueryClient();
  const prescribeFn = useServerFn(prescribeTrainingWithAi);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<AiPrescription | null>(null);

  async function generate() {
    if (!programId) return;
    if (prompt.trim().length < 5) return toast.error("Descreva o que a IA deve gerar.");
    setLoading(true);
    setResult(null);
    try {
      const r = await prescribeFn({ data: { programId, prompt: prompt.trim() } });
      setResult(r);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar prescrição");
    } finally {
      setLoading(false);
    }
  }

  async function apply() {
    if (!programId || !result?.days?.length) return;
    setApplying(true);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) { setApplying(false); return; }

    try {
      for (const [i, day] of result.days.entries()) {
        const { data: inserted, error } = await supabase
          .from("pt_training_days" as never)
          .insert({
            user_id: userId,
            program_id: programId,
            name: day.name,
            day_label: day.day_label,
            description: day.description ?? null,
            sort_order: 1000 + i,
          } as never)
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        const dayId = (inserted as any).id as string;

        if (day.exercises?.length) {
          const rows = day.exercises.map((ex, idx) => ({
            user_id: userId,
            training_day_id: dayId,
            name: ex.name,
            series_type: ex.series_type ?? "reps_load",
            sets_reps: ex.sets_reps ?? null,
            load: ex.load ?? null,
            time_seconds: ex.time_seconds ?? null,
            inclination: ex.inclination ?? null,
            pace: ex.pace ?? null,
            cadence: ex.cadence ?? null,
            rest_seconds: ex.rest_seconds ?? null,
            observations: ex.observations ?? null,
            sort_order: idx,
          }));
          const { error: exErr } = await supabase
            .from("pt_training_exercises" as never)
            .insert(rows as never);
          if (exErr) throw new Error(exErr.message);
        }
      }


      // Save the prompt on the program so trainer can review later
      await supabase
        .from("pt_programs" as never)
        .update({ ai_prompt: prompt.trim(), ai_generated_at: new Date().toISOString() } as never)
        .eq("id", programId);

      toast.success("Prescrição aplicada à rotina");
      qc.invalidateQueries({ queryKey: ["pt-training-days", programId] });
      qc.invalidateQueries({ queryKey: ["pt-programs"] });
      onOpenChange(false);
      setResult(null);
      setPrompt("");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao aplicar prescrição");
    } finally {
      setApplying(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Prescrever com IA
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Instruções para a IA</Label>
            <Textarea
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ex: Divida em 4 treinos (A, B, C, D) focando peito+tríceps, costas+bíceps, pernas e ombros+abdômen. Priorize exercícios compostos, 4 séries de 8 a 12 reps."
            />
            <p className="text-xs text-muted-foreground">
              A IA usa a categoria, nível e objetivos definidos na rotina.
            </p>
          </div>

          <Button onClick={generate} disabled={loading} className="w-full sm:w-auto">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Gerando…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Gerar prescrição
              </>
            )}
          </Button>

          {result && (
            <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
              <p className="text-sm font-semibold">Prévia ({result.days.length} treinos)</p>
              {result.days.map((d, i) => (
                <div key={i} className="rounded-md border bg-background p-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{d.name}</span>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {d.day_label}
                    </span>
                  </div>
                  {d.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{d.description}</p>
                  )}
                  {d.exercises?.length ? (
                    <ul className="mt-2 space-y-1 text-sm">
                      {d.exercises.map((ex, j) => (
                        <li key={j} className="flex flex-wrap justify-between gap-2 border-t pt-1 first:border-t-0 first:pt-0">
                          <span className="font-medium">{ex.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {[ex.sets_reps, ex.load, ex.rest_seconds ? `${ex.rest_seconds}s` : null]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                          {ex.observations && (
                            <span className="w-full text-xs text-muted-foreground">
                              {ex.observations}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
              {result.notes && (
                <div className="rounded-md border-l-2 border-primary/40 bg-background p-2 text-xs italic text-muted-foreground">
                  {result.notes}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button onClick={apply} disabled={!result || applying}>
            {applying ? "Aplicando…" : "Adicionar treinos à rotina"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
