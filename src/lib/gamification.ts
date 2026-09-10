import { startOfWeek, format, subWeeks } from "date-fns";

export interface StudentBadge {
  id: string;
  title: string;
  description: string;
  icon: string; // emoji or icon identifier
  unlocked: boolean;
  unlockedAt?: string;
  tier: "bronze" | "silver" | "gold" | "diamond";
}

export interface GamificationStats {
  currentStreakWeeks: number;
  bestStreakWeeks: number;
  totalWorkouts: number;
  level: {
    tier: string;
    name: string;
    current: number;
    nextLevelAt: number;
    progressPercent: number;
    color: string;
  };
  badges: StudentBadge[];
}

export function calculateGamificationStats(
  sessions: { session_date?: string; status?: string }[],
  executions: { executed_at?: string }[] = [],
): GamificationStats {
  // Collect all unique completed workout dates
  const dateSet = new Set<string>();

  for (const s of sessions) {
    if (s.status === "completed" && s.session_date) {
      dateSet.add(s.session_date.slice(0, 10));
    }
  }

  for (const e of executions) {
    if (e.executed_at) {
      dateSet.add(e.executed_at.slice(0, 10));
    }
  }

  const sortedDates = Array.from(dateSet).sort();
  const totalWorkouts = sortedDates.length;

  // Group dates by week
  const weekSet = new Set<string>();
  for (const d of sortedDates) {
    const weekStart = format(startOfWeek(new Date(d + "T12:00"), { weekStartsOn: 1 }), "yyyy-MM-dd");
    weekSet.add(weekStart);
  }

  // Calculate current streak
  let currentStreak = 0;
  let cursor = startOfWeek(new Date(), { weekStartsOn: 1 });
  const thisWeekKey = format(cursor, "yyyy-MM-dd");
  const lastWeekKey = format(subWeeks(cursor, 1), "yyyy-MM-dd");

  // Check if current week or last week has activity
  if (weekSet.has(thisWeekKey) || weekSet.has(lastWeekKey)) {
    let checkDate = weekSet.has(thisWeekKey) ? cursor : subWeeks(cursor, 1);
    while (weekSet.has(format(checkDate, "yyyy-MM-dd"))) {
      currentStreak++;
      checkDate = subWeeks(checkDate, 1);
    }
  }

  // Calculate level
  let level = {
    tier: "Ferro",
    name: "Iniciante",
    current: totalWorkouts,
    nextLevelAt: 10,
    progressPercent: Math.min(100, (totalWorkouts / 10) * 100),
    color: "text-muted-foreground",
  };

  if (totalWorkouts >= 200) {
    level = { tier: "Elite", name: "Elite Montanha", current: totalWorkouts, nextLevelAt: 300, progressPercent: 100, color: "text-amber-400" };
  } else if (totalWorkouts >= 100) {
    level = { tier: "Diamante", name: "Centurião", current: totalWorkouts, nextLevelAt: 200, progressPercent: ((totalWorkouts - 100) / 100) * 100, color: "text-cyan-400" };
  } else if (totalWorkouts >= 50) {
    level = { tier: "Ouro", name: "Veterano", current: totalWorkouts, nextLevelAt: 100, progressPercent: ((totalWorkouts - 50) / 50) * 100, color: "text-amber-500" };
  } else if (totalWorkouts >= 25) {
    level = { tier: "Prata", name: "Dedicado", current: totalWorkouts, nextLevelAt: 50, progressPercent: ((totalWorkouts - 25) / 25) * 100, color: "text-slate-300" };
  } else if (totalWorkouts >= 10) {
    level = { tier: "Bronze", name: "Constante", current: totalWorkouts, nextLevelAt: 25, progressPercent: ((totalWorkouts - 10) / 15) * 100, color: "text-amber-700" };
  }

  // Badges
  const badges: StudentBadge[] = [
    {
      id: "first_workout",
      title: "Primeiro Passo",
      description: "Concluiu seu primeiro treino no studio",
      icon: "🥉",
      tier: "bronze",
      unlocked: totalWorkouts >= 1,
    },
    {
      id: "streak_3",
      title: "Em Chamas",
      description: "Manteve 3 semanas consecutivas de presença",
      icon: "🔥",
      tier: "bronze",
      unlocked: currentStreak >= 3,
    },
    {
      id: "club_10",
      title: "Clube dos 10",
      description: "Alcançou a marca de 10 aulas completadas",
      icon: "🎯",
      tier: "bronze",
      unlocked: totalWorkouts >= 10,
    },
    {
      id: "streak_8",
      title: "Hábito Blindado",
      description: "8 semanas consecutivas sem falhar",
      icon: "⚡",
      tier: "silver",
      unlocked: currentStreak >= 8,
    },
    {
      id: "club_25",
      title: "Clube dos 25",
      description: "Completou 25 treinos",
      icon: "🏆",
      tier: "silver",
      unlocked: totalWorkouts >= 25,
    },
    {
      id: "club_50",
      title: "Clube dos 50",
      description: "50 treinos de dedicação exemplar",
      icon: "🎖️",
      tier: "gold",
      unlocked: totalWorkouts >= 50,
    },
    {
      id: "streak_12",
      title: "Mestre do Foco",
      description: "12 semanas consecutivas (3 meses de disciplina inabalável)",
      icon: "🌟",
      tier: "gold",
      unlocked: currentStreak >= 12,
    },
    {
      id: "club_100",
      title: "Centurião Montanha",
      description: "100 treinos concluídos com excelência!",
      icon: "👑",
      tier: "diamond",
      unlocked: totalWorkouts >= 100,
    },
  ];

  return {
    currentStreakWeeks: currentStreak,
    bestStreakWeeks: Math.max(currentStreak, 0),
    totalWorkouts,
    level,
    badges,
  };
}
