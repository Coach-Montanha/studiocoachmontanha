import { useState, useMemo } from "react";
import { Trophy, Dumbbell, Calculator, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDateBR } from "@/lib/format";
import { detectPersonalRecords, type PersonalRecord } from "@/lib/one-rep-max";
import { OneRepMaxDialog } from "./OneRepMaxDialog";

export function HallOfFameCard({
  executions,
  className,
}: {
  executions: any[];
  className?: string;
}) {
  const [oneRmOpen, setOneRmOpen] = useState(false);
  const [selectedWeight, setSelectedWeight] = useState<number>(60);

  const personalRecords = useMemo(() => {
    return detectPersonalRecords(executions);
  }, [executions]);

  const handleOpenCalc = (load?: number) => {
    if (load && load > 0) setSelectedWeight(load);
    setOneRmOpen(true);
  };

  return (
    <>
      <Card className={`p-5 space-y-4 ${className || ""}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/20">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Hall da Fama (Recordes Pessoais)</h3>
              <p className="text-xs text-muted-foreground">Maiores cargas registradas em treinos</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleOpenCalc()}
            className="text-xs"
          >
            <Calculator className="h-3.5 w-3.5 mr-1 text-primary" /> Calcular 1RM
          </Button>
        </div>

        {personalRecords.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/70 p-4 text-center text-xs text-muted-foreground">
            <p>Nenhum recorde registrado ainda.</p>
            <p className="mt-1 text-[11px]">As cargas inseridas durante a execução das aulas serão ranqueadas aqui automaticamente!</p>
          </div>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {personalRecords.slice(0, 6).map((pr, index) => (
              <div
                key={pr.exerciseId}
                className="group relative rounded-xl border border-border/80 bg-muted/20 p-3 transition-all hover:border-amber-500/30 hover:bg-muted/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {index === 0 ? (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-black shadow-xs">
                        1º
                      </span>
                    ) : (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                        {index + 1}º
                      </span>
                    )}
                    <span className="font-semibold text-xs text-foreground truncate">
                      {pr.exerciseName}
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-extrabold text-amber-600 dark:text-amber-400">
                    <Sparkles className="h-3 w-3" /> {pr.rawLoad}
                  </span>
                </div>

                <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/40 pt-1.5">
                  <span>Batido em: {formatDateBR(pr.achievedAt)}</span>
                  <button
                    type="button"
                    onClick={() => handleOpenCalc(pr.maxLoad)}
                    className="text-[10px] font-semibold text-primary hover:underline"
                  >
                    Ver 1RM →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <OneRepMaxDialog
        open={oneRmOpen}
        onOpenChange={setOneRmOpen}
        initialWeight={selectedWeight}
      />
    </>
  );
}
