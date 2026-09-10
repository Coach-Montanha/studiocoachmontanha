import { useState, useMemo } from "react";
import { Calculator, Dumbbell, Zap, Target } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { calculateOneRepMax } from "@/lib/one-rep-max";

export function OneRepMaxDialog({
  open,
  onOpenChange,
  initialWeight = 60,
  initialReps = 8,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialWeight?: number;
  initialReps?: number;
}) {
  const [weight, setWeight] = useState<number>(initialWeight);
  const [reps, setReps] = useState<number>(initialReps);

  const result = useMemo(() => {
    if (!weight || weight <= 0 || !reps || reps <= 0) return null;
    return calculateOneRepMax(weight, Math.min(reps, 20));
  }, [weight, reps]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" /> Calculadora de 1RM (Repetição Máxima)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-xs text-muted-foreground">
            Estime sua carga máxima teórica (1RM) e descubra as faixas ideais para hipertrofia, força e resistência.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Carga Utilizada (kg)</Label>
              <div className="relative">
                <Dumbbell className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  step="0.5"
                  min="1"
                  className="pl-9"
                  value={weight || ""}
                  onChange={(e) => setWeight(Number(e.target.value))}
                  placeholder="Ex: 80"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Repetições Realizadas</Label>
              <div className="relative">
                <Zap className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  min="1"
                  max="20"
                  className="pl-9"
                  value={reps || ""}
                  onChange={(e) => setReps(Number(e.target.value))}
                  placeholder="Ex: 8"
                />
              </div>
            </div>
          </div>

          {result && (
            <>
              {/* Highlight estimated 1RM */}
              <Card className="border-primary/40 bg-primary/5 p-4 text-center">
                <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                  Estimativa de 1RM
                </span>
                <div className="mt-1 text-3xl font-extrabold text-foreground tabular-nums">
                  {result.average1RM} kg
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Média de 3 fórmulas consagradas (Epley: {result.epley}kg · Brzycki: {result.brzycki}kg · Lander: {result.lander}kg)
                </p>
              </Card>

              {/* Intensity Zones & Percentages */}
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5" /> Tabela de Cargas por Zona de Treinamento
                </Label>
                <div className="divide-y divide-border/60 rounded-xl border border-border/80 bg-muted/20 overflow-hidden text-xs">
                  {result.percentages.map((item) => (
                    <div
                      key={item.percentage}
                      className="flex items-center justify-between p-2.5 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="inline-flex w-10 shrink-0 font-bold text-primary tabular-nums">
                          {item.percentage}%
                        </span>
                        <span className="font-semibold text-foreground">{item.weight} kg</span>
                        <span className="text-muted-foreground">({item.estimatedReps})</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground font-medium truncate">
                        {item.zone}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
