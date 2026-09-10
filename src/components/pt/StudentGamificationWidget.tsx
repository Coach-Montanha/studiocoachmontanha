import { Flame, Award, Trophy, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { calculateGamificationStats, type GamificationStats } from "@/lib/gamification";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function StudentGamificationWidget({
  sessions,
  executions = [],
  className,
}: {
  sessions: any[];
  executions?: any[];
  className?: string;
}) {
  const [badgeModalOpen, setBadgeModalOpen] = useState(false);
  const stats = calculateGamificationStats(sessions, executions);

  const unlockedCount = stats.badges.filter((b) => b.unlocked).length;

  return (
    <>
      <Card
        className={`relative overflow-hidden p-4 sm:p-5 border-amber-500/25 bg-gradient-to-br from-amber-500/[0.04] via-card to-card shadow-card ${
          className || ""
        }`}
      >
        <div className="grid gap-4 sm:grid-cols-3 items-center">
          {/* Streak Flame */}
          <div className="flex items-center gap-3.5 sm:border-r border-border/60 sm:pr-4">
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-red-500 text-white shadow-md shadow-amber-500/20">
              <Flame className="h-7 w-7 animate-pulse" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
                Fogo de Consistência
              </div>
              <div className="text-xl font-extrabold text-foreground tabular-nums">
                {stats.currentStreakWeeks > 0
                  ? `${stats.currentStreakWeeks} ${stats.currentStreakWeeks === 1 ? "semana" : "semanas"}`
                  : "Comece hoje!"}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {stats.currentStreakWeeks > 0 ? "Frequência ininterrupta" : "Faça check-in nesta semana"}
              </p>
            </div>
          </div>

          {/* Level & Progress */}
          <div className="space-y-1.5 sm:border-r border-border/60 sm:pr-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold uppercase tracking-wider text-muted-foreground text-[10px]">
                Nível: <span className="text-foreground">{stats.level.tier}</span> ({stats.level.name})
              </span>
              <span className="font-semibold text-primary tabular-nums">
                {stats.totalWorkouts}/{stats.level.nextLevelAt}
              </span>
            </div>
            <Progress value={stats.level.progressPercent} className="h-2" />
            <p className="text-[11px] text-muted-foreground">
              {stats.level.nextLevelAt - stats.totalWorkouts > 0
                ? `Faltam ${stats.level.nextLevelAt - stats.totalWorkouts} treinos para subir de faixa`
                : "Nível máximo alcançado!"}
            </p>
          </div>

          {/* Badges showcase */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Conquistas Desbloqueadas
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                {stats.badges.slice(0, 4).map((badge) => (
                  <span
                    key={badge.id}
                    title={`${badge.title}: ${badge.description}`}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm transition-transform hover:scale-110 select-none ${
                      badge.unlocked
                        ? "bg-amber-500/10 border border-amber-500/30 shadow-2xs"
                        : "bg-muted/40 opacity-40 grayscale"
                    }`}
                  >
                    {badge.icon}
                  </span>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setBadgeModalOpen(true)}
              className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors shrink-0"
            >
              <span>{unlockedCount}/{stats.badges.length}</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </Card>

      {/* Badges Detail Dialog */}
      <Dialog open={badgeModalOpen} onOpenChange={setBadgeModalOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" /> Galeria de Conquistas do Aluno
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              Insígnias conquistadas automaticamente conforme a assiduidade e disciplina nos treinos.
            </p>

            <div className="grid gap-2.5">
              {stats.badges.map((badge) => (
                <div
                  key={badge.id}
                  className={`flex items-start gap-3 rounded-xl border p-3 transition-all ${
                    badge.unlocked
                      ? "border-amber-500/30 bg-amber-500/5 shadow-2xs"
                      : "border-border/60 bg-muted/20 opacity-50 grayscale"
                  }`}
                >
                  <div className="text-2xl shrink-0 mt-0.5">{badge.icon}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-bold text-foreground">{badge.title}</h4>
                      {badge.unlocked ? (
                        <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                          Conquistado
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                          Bloqueado
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{badge.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
