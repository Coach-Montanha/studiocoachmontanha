import { supabase } from "@/integrations/supabase/client";

export interface StudentAnamnesis {
  id?: string;
  user_id?: string;
  pt_student_id: string;

  // PAR-Q (Physical Activity Readiness Questionnaire)
  parq_heart_condition: boolean;
  parq_chest_pain_activity: boolean;
  parq_chest_pain_rest: boolean;
  parq_dizziness: boolean;
  parq_bone_joint_problem: boolean;
  parq_blood_pressure_meds: boolean;
  parq_other_reason: boolean;

  // Articulações e Lesões
  joint_spine: boolean;
  joint_knee: boolean;
  joint_shoulder: boolean;
  joint_hip: boolean;
  joint_ankle: boolean;
  orthopedic_injuries?: string | null;

  // Histórico Clínico
  medical_conditions?: string | null;
  surgeries?: string | null;
  medications?: string | null;

  // Hábitos & Rotina
  sleep_hours?: number | null;
  stress_level?: "low" | "moderate" | "high" | string | null;
  exercise_experience?: "sedentario" | "iniciante" | "intermediario" | "avancado" | string | null;
  contraindications?: string | null;
  risk_level: "low" | "moderate" | "high";
  notes?: string | null;

  created_at?: string;
  updated_at?: string;
}

export const PARQ_QUESTIONS = [
  {
    key: "parq_heart_condition",
    question: "Algum médico já disse que você possui algum problema cardíaco?",
  },
  {
    key: "parq_chest_pain_activity",
    question: "Você sente dores no peito quando pratica atividade física?",
  },
  {
    key: "parq_chest_pain_rest",
    question: "No último mês, você sentiu dor no peito em repouso (sem praticar atividade física)?",
  },
  {
    key: "parq_dizziness",
    question: "Você costuma perder o equilíbrio por causa de tonturas ou já perdeu a consciência?",
  },
  {
    key: "parq_bone_joint_problem",
    question: "Você tem algum problema ósseo ou articular que possa piorar com a atividade física?",
  },
  {
    key: "parq_blood_pressure_meds",
    question: "Você toma medicamentos de uso contínuo para pressão arterial ou problema cardíaco?",
  },
  {
    key: "parq_other_reason",
    question: "Você tem conhecimento de alguma outra razão médica pela qual não deva praticar exercícios?",
  },
] as const;

export function calculateRiskLevel(data: Partial<StudentAnamnesis>): "low" | "moderate" | "high" {
  // Se responder "sim" para problema cardíaco, dor no peito ou tontura -> Alto Risco
  if (data.parq_heart_condition || data.parq_chest_pain_activity || data.parq_chest_pain_rest || data.parq_dizziness) {
    return "high";
  }

  // Se responder "sim" para pressão arterial, ossos/articulações ou outras razões -> Risco Moderado
  if (
    data.parq_bone_joint_problem ||
    data.parq_blood_pressure_meds ||
    data.parq_other_reason ||
    data.joint_spine ||
    data.joint_knee ||
    data.joint_shoulder ||
    (data.orthopedic_injuries && data.orthopedic_injuries.trim().length > 3)
  ) {
    return "moderate";
  }

  return "low";
}

export function extractClinicalAlerts(anamnesis?: Partial<StudentAnamnesis> | null): string[] {
  if (!anamnesis) return [];
  const alerts: string[] = [];

  if (anamnesis.parq_heart_condition) alerts.push("Cardiopatia diagnosticada");
  if (anamnesis.parq_chest_pain_activity || anamnesis.parq_chest_pain_rest) alerts.push("Dor no peito relatada");
  if (anamnesis.parq_dizziness) alerts.push("Tonturas / Perda de equilíbrio");
  if (anamnesis.parq_blood_pressure_meds) alerts.push("Uso de anti-hipertensivo");

  if (anamnesis.joint_spine) alerts.push("Coluna / Lombar");
  if (anamnesis.joint_knee) alerts.push("Joelhos");
  if (anamnesis.joint_shoulder) alerts.push("Ombros");
  if (anamnesis.joint_hip) alerts.push("Quadril");

  if (anamnesis.orthopedic_injuries && anamnesis.orthopedic_injuries.trim()) {
    alerts.push(`Lesão: ${anamnesis.orthopedic_injuries.trim()}`);
  }

  if (anamnesis.contraindications && anamnesis.contraindications.trim()) {
    alerts.push(`Restrição: ${anamnesis.contraindications.trim()}`);
  }

  return alerts;
}

const LOCAL_STORAGE_KEY_PREFIX = "pt_student_anamnesis_";

export async function getStudentAnamnesis(studentId: string): Promise<StudentAnamnesis | null> {
  // 1. Tenta buscar no Supabase
  try {
    const { data, error } = await supabase
      .from("pt_student_anamnesis" as never)
      .select("*")
      .eq("pt_student_id", studentId)
      .maybeSingle();

    if (!error && data) {
      return data as StudentAnamnesis;
    }
  } catch {
    // Falha de rede ou tabela ainda não migrada
  }

  // 2. Fallback para localStorage
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${studentId}`);
      if (stored) {
        return JSON.parse(stored) as StudentAnamnesis;
      }
    } catch {
      // ignore
    }
  }

  return null;
}

export async function saveStudentAnamnesis(
  studentId: string,
  input: Partial<StudentAnamnesis>,
): Promise<StudentAnamnesis> {
  const risk_level = calculateRiskLevel(input);

  const payload: Partial<StudentAnamnesis> = {
    ...input,
    pt_student_id: studentId,
    risk_level,
    updated_at: new Date().toISOString(),
  };

  // Salva no localStorage como garantia
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${studentId}`, JSON.stringify(payload));
    } catch {
      // ignore
    }
  }

  // Tenta salvar no Supabase
  try {
    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes.user?.id;
    if (userId) {
      payload.user_id = userId;
    }

    const { data: existing } = await supabase
      .from("pt_student_anamnesis" as never)
      .select("id")
      .eq("pt_student_id", studentId)
      .maybeSingle();

    if (existing && (existing as any).id) {
      const { data, error } = await supabase
        .from("pt_student_anamnesis" as never)
        .update(payload as never)
        .eq("id", (existing as any).id)
        .select()
        .single();
      if (!error && data) return data as StudentAnamnesis;
    } else {
      const { data, error } = await supabase
        .from("pt_student_anamnesis" as never)
        .insert(payload as never)
        .select()
        .single();
      if (!error && data) return data as StudentAnamnesis;
    }

    // Sincroniza um resumo das restrições na tabela pt_students.health_notes
    const alerts = extractClinicalAlerts(payload);
    if (alerts.length > 0) {
      await supabase
        .from("pt_students")
        .update({ health_notes: alerts.join(" • ") })
        .eq("id", studentId);
    }
  } catch {
    // ignore
  }

  return payload as StudentAnamnesis;
}
