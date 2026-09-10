/**
 * Fórmulas científicas para cálculo e predição de 1RM (Repetição Máxima)
 * e detecção automática de Recordes Pessoais (PRs) a partir do histórico de treinos.
 */

export interface OneRepMaxResult {
  weight: number;
  reps: number;
  epley: number;
  brzycki: number;
  lander: number;
  average1RM: number;
  percentages: {
    percentage: number;
    weight: number;
    estimatedReps: string;
    zone: string;
  }[];
}

export function calculateOneRepMax(weight: number, reps: number): OneRepMaxResult {
  if (reps <= 1) {
    const w = weight;
    return generateResult(w, 1, w, w, w, w);
  }

  // Fórmulas
  const epley = Number((weight * (1 + 0.0333 * reps)).toFixed(1));
  const brzycki = Number((weight / (1.0278 - 0.0278 * reps)).toFixed(1));
  const lander = Number(((100 * weight) / (101.3 - 2.67123 * reps)).toFixed(1));

  const average1RM = Number(((epley + brzycki + lander) / 3).toFixed(1));

  return generateResult(weight, reps, epley, brzycki, lander, average1RM);
}

function generateResult(
  weight: number,
  reps: number,
  epley: number,
  brzycki: number,
  lander: number,
  average1RM: number,
): OneRepMaxResult {
  const table = [
    { percentage: 100, estimatedReps: "1 RM", zone: "Força Pura / Teste Máximo" },
    { percentage: 95, estimatedReps: "2 RM", zone: "Força Máxima" },
    { percentage: 90, estimatedReps: "3 - 4 reps", zone: "Força Máxima" },
    { percentage: 85, estimatedReps: "5 - 6 reps", zone: "Força & Potência" },
    { percentage: 80, estimatedReps: "7 - 8 reps", zone: "Hipertrofia Miofibrilar" },
    { percentage: 75, estimatedReps: "9 - 10 reps", zone: "Hipertrofia Geral" },
    { percentage: 70, estimatedReps: "11 - 12 reps", zone: "Hipertrofia Sarcoplasmática" },
    { percentage: 65, estimatedReps: "15 reps", zone: "Resistência Muscular" },
    { percentage: 60, estimatedReps: "20 reps", zone: "Resistência Muscular" },
  ];

  const percentages = table.map((item) => ({
    ...item,
    weight: Number(((average1RM * item.percentage) / 100).toFixed(1)),
  }));

  return {
    weight,
    reps,
    epley,
    brzycki,
    lander,
    average1RM,
    percentages,
  };
}

export interface PersonalRecord {
  exerciseId: string;
  exerciseName: string;
  maxLoad: number;
  rawLoad: string;
  achievedAt: string;
  executionId: string;
}

/**
 * Extrai o valor numérico de cargas (ex: "80kg" -> 80, "12.5 kg" -> 12.5, "100" -> 100)
 */
export function extractLoadNumber(loadStr: string): number | null {
  if (!loadStr) return null;
  const cleaned = loadStr.replace(",", ".").trim();
  const match = cleaned.match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}

/**
 * Varre o histórico de execuções de treinos e identifica os Recordes Pessoais (PRs)
 */
export function detectPersonalRecords(executions: any[]): PersonalRecord[] {
  const prMap = new Map<string, PersonalRecord>();

  for (const exec of executions) {
    let notes: any = {};
    try {
      notes = typeof exec.notes === "string" ? JSON.parse(exec.notes || "{}") : (exec.notes || {});
    } catch {
      notes = {};
    }

    const loads = notes.loads || {};
    for (const [exId, rawLoad] of Object.entries(loads)) {
      if (typeof rawLoad !== "string" && typeof rawLoad !== "number") continue;
      const numLoad = extractLoadNumber(String(rawLoad));
      if (!numLoad || numLoad <= 0) continue;

      const current = prMap.get(exId);
      if (!current || numLoad > current.maxLoad) {
        prMap.set(exId, {
          exerciseId: exId,
          exerciseName: `Exercício #${exId.slice(-4)}`,
          maxLoad: numLoad,
          rawLoad: String(rawLoad),
          achievedAt: exec.executed_at,
          executionId: exec.id,
        });
      }
    }
  }

  return Array.from(prMap.values()).sort((a, b) => b.maxLoad - a.maxLoad);
}
