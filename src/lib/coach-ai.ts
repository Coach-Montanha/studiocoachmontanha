import { formatSeconds } from "@/components/pt/SessionTimer";
import type { StudentAnamnesis } from "@/lib/anamnesis";

export interface WorkoutFeedbackParams {
  studentName: string;
  studentPhone?: string | null;
  workoutName: string;
  executedAt?: string | Date;
  timerSeconds?: number;
  loads?: Record<string, string>;
  totalExercisesDone?: number;
  newPrsCount?: number;
}

export function generateWorkoutWhatsAppFeedback({
  studentName,
  workoutName,
  timerSeconds = 0,
  loads = {},
  totalExercisesDone = 0,
  newPrsCount = 0,
}: WorkoutFeedbackParams): string {
  const firstName = studentName.trim().split(" ")[0];
  const timeFormatted = timerSeconds > 0 ? formatSeconds(timerSeconds) : "45:00";

  // Calcular carga máxima levantada e volume estimado
  let maxLoad = 0;
  let totalVolumeKg = 0;
  for (const v of Object.values(loads)) {
    const num = parseFloat(String(v).replace(",", ".").replace(/[^\d.]/g, ""));
    if (!isNaN(num) && num > 0) {
      if (num > maxLoad) maxLoad = num;
      totalVolumeKg += num * 30; // estimativa de 3x10
    }
  }

  const parts: string[] = [];

  parts.push(`Fala, *${firstName}*! Tudo bem? 🔥`);
  parts.push(`Passando para parabenizar pelo treinão de hoje: *${workoutName}*! 👏`);
  parts.push("");
  parts.push("📊 *Resumo da sua sessão:*");
  if (timerSeconds > 0) {
    parts.push(`⏱️ Duração: *${timeFormatted}*`);
  }
  if (totalExercisesDone > 0) {
    parts.push(`✅ Exercícios concluídos: *${totalExercisesDone}*`);
  }
  if (maxLoad > 0) {
    parts.push(`💥 Maior carga do dia: *${maxLoad} kg*`);
  }
  if (totalVolumeKg > 0) {
    parts.push(`🏋️ Tonelagem acumulada: *${Math.round(totalVolumeKg).toLocaleString("pt-BR")} kg levantados*`);
  }
  if (newPrsCount > 0) {
    parts.push(`🏆 *${newPrsCount} novo(s) recorde(s) de carga atingido(s)! Sensacional!*`);
  }

  parts.push("");
  parts.push("💪 *Orientações pós-treino:*");
  parts.push("Capricha na hidratação, alimentação proteica e no descanso regenerativo hoje. Cada treino conta para a sua meta!");
  parts.push("");
  parts.push("Nos vemos no próximo treino! 🚀");
  parts.push("_Studio Coach Montanha — Excelência em Treinamento_");

  return parts.join("\n");
}

export function createWhatsAppUrl(phone?: string | null, text?: string): string {
  if (!text) return "";
  let cleanPhone = phone ? phone.replace(/\D/g, "") : "";
  if (cleanPhone && cleanPhone.length >= 10 && cleanPhone.length <= 11) {
    cleanPhone = `55${cleanPhone}`;
  }

  const encodedText = encodeURIComponent(text);
  if (cleanPhone) {
    return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
  }
  return `https://api.whatsapp.com/send?text=${encodedText}`;
}

export interface ContraindicationRule {
  joint: string;
  contraindicated: string[];
  safeAlternatives: string[];
  reason: string;
}

export const CLINICAL_EXERCISE_RULES: ContraindicationRule[] = [
  {
    joint: "Coluna / Lombar",
    contraindicated: ["Agachamento livre pesado", "Levantamento terra", "Desenvolvimento militar em pé", "Remada curvada livre"],
    safeAlternatives: ["Leg press 45° com apoio lombar", "Elevação pélvica no banco", "Desenvolvimento sentado com encosto", "Remada baixa articulada"],
    reason: "Reduz a compressão axial nos discos intervertebrais e estabiliza a lombar.",
  },
  {
    joint: "Joelhos",
    contraindicated: ["Cadeira extensora pesada final de amplitude", "Agachamento profundo sissy", "Passada com avanço descontrolado"],
    safeAlternatives: ["Agachamento búlgaro controlado", "Leg press horizontal", "Stiff e mesa flexora (foco cadeia posterior)"],
    reason: "Protege a cartilagem retropatelar e evita forças de cisalhamento anteriores.",
  },
  {
    joint: "Ombros",
    contraindicated: ["Desenvolvimento com barra atrás da nuca", "Puxada atrás da nuca", "Supino com amplitude hiperestendida"],
    safeAlternatives: ["Supino com halteres pegada neutra", "Puxada frontal pronada/neutra", "Elevação lateral no plano escapular"],
    reason: "Evita impacto subacromial e protege os tendões do manguito rotador.",
  },
];

export function checkContraindications(
  exerciseName: string,
  anamnesis?: Partial<StudentAnamnesis> | null,
): { isContraindicated: boolean; reason?: string; suggestedAlternative?: string } {
  if (!anamnesis) return { isContraindicated: false };

  const nameLower = exerciseName.toLowerCase();

  for (const rule of CLINICAL_EXERCISE_RULES) {
    const hasSpineIssue = rule.joint.includes("Coluna") && (anamnesis.joint_spine || (anamnesis.orthopedic_injuries && /lombar|hernia|coluna/i.test(anamnesis.orthopedic_injuries)));
    const hasKneeIssue = rule.joint.includes("Joelho") && (anamnesis.joint_knee || (anamnesis.orthopedic_injuries && /joelho|condro|menisco/i.test(anamnesis.orthopedic_injuries)));
    const hasShoulderIssue = rule.joint.includes("Ombro") && (anamnesis.joint_shoulder || (anamnesis.orthopedic_injuries && /ombro|manguito|impacto/i.test(anamnesis.orthopedic_injuries)));

    if (hasSpineIssue || hasKneeIssue || hasShoulderIssue) {
      for (let i = 0; i < rule.contraindicated.length; i++) {
        const contra = rule.contraindicated[i];
        if (nameLower.includes(contra.toLowerCase().slice(0, 8))) {
          return {
            isContraindicated: true,
            reason: `${rule.joint}: ${rule.reason}`,
            suggestedAlternative: rule.safeAlternatives[i % rule.safeAlternatives.length],
          };
        }
      }
    }
  }

  return { isContraindicated: false };
}
