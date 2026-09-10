import { supabase } from "@/integrations/supabase/client";

export interface PhysicalAssessment {
  id: string;
  pt_student_id: string;
  user_id?: string;
  assessment_date: string;
  weight: number; // kg
  height: number; // cm
  body_fat_percentage?: number | null; // %
  muscle_mass_percentage?: number | null; // %
  notes?: string | null;

  // Circunferências (cm)
  chest?: number | null;
  waist?: number | null;
  abdomen?: number | null;
  hips?: number | null;
  right_arm?: number | null;
  left_arm?: number | null;
  right_thigh?: number | null;
  left_thigh?: number | null;
  right_calf?: number | null;
  left_calf?: number | null;

  // Fotos
  photo_front?: string | null;
  photo_back?: string | null;
  photo_side?: string | null;

  created_at?: string;
}

export function calculateBMI(weightKg: number, heightCm: number): number {
  if (!weightKg || !heightCm) return 0;
  const heightM = heightCm / 100;
  return Number((weightKg / (heightM * heightM)).toFixed(1));
}

export function getBMICategory(bmi: number): { label: string; tone: "success" | "warning" | "destructive" | "neutral" } {
  if (!bmi || bmi <= 0) return { label: "Não calculado", tone: "neutral" };
  if (bmi < 18.5) return { label: "Abaixo do peso", tone: "warning" };
  if (bmi <= 24.9) return { label: "Peso normal", tone: "success" };
  if (bmi <= 29.9) return { label: "Sobrepeso", tone: "warning" };
  if (bmi <= 34.9) return { label: "Obesidade Grau I", tone: "destructive" };
  if (bmi <= 39.9) return { label: "Obesidade Grau II", tone: "destructive" };
  return { label: "Obesidade Mórbida", tone: "destructive" };
}

const LOCAL_STORAGE_KEY_PREFIX = "eduflow_pt_assessments_";

function getLocalAssessments(studentId: string): PhysicalAssessment[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${studentId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalAssessments(studentId: string, items: PhysicalAssessment[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${studentId}`, JSON.stringify(items));
  } catch (err) {
    console.error("Erro ao salvar avaliações no localStorage:", err);
  }
}

export const getStudentAssessments = fetchPhysicalAssessments;

export async function fetchPhysicalAssessments(studentId: string): Promise<PhysicalAssessment[]> {
  try {
    const { data, error } = await supabase
      .from("pt_physical_assessments" as any)
      .select("*")
      .eq("pt_student_id", studentId)
      .order("assessment_date", { ascending: false });

    if (!error && data && data.length > 0) {
      // Sincroniza cópia de segurança local
      setLocalAssessments(studentId, data as any[]);
      return data as any[];
    }
  } catch (err) {
    console.warn("Supabase pt_physical_assessments inacessível, utilizando cache local:", err);
  }

  // Fallback local
  return getLocalAssessments(studentId).sort(
    (a, b) => new Date(b.assessment_date).getTime() - new Date(a.assessment_date).getTime(),
  );
}

export async function savePhysicalAssessment(
  studentId: string,
  assessment: Omit<PhysicalAssessment, "id"> & { id?: string },
): Promise<PhysicalAssessment> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id || "local-user";

  const newId = assessment.id || crypto.randomUUID();
  const record: PhysicalAssessment = {
    ...assessment,
    id: newId,
    pt_student_id: studentId,
    user_id: userId,
    created_at: new Date().toISOString(),
  };

  // Salva no fallback local
  const current = getLocalAssessments(studentId);
  const updated = current.some((a) => a.id === newId)
    ? current.map((a) => (a.id === newId ? record : a))
    : [record, ...current];
  setLocalAssessments(studentId, updated);

  try {
    const { error } = await supabase
      .from("pt_physical_assessments" as any)
      .upsert(record as any);

    if (error) {
      console.warn("Erro ao persistir avaliação no Supabase, mantido em cache local:", error.message);
    }
  } catch (err) {
    console.warn("Supabase indisponível no momento, avaliação armazenada localmente com sucesso.");
  }

  return record;
}

export async function deletePhysicalAssessment(id: string, studentId: string): Promise<void> {
  const current = getLocalAssessments(studentId);
  setLocalAssessments(
    studentId,
    current.filter((a) => a.id !== id),
  );

  try {
    await supabase.from("pt_physical_assessments" as any).delete().eq("id", id);
  } catch (err) {
    console.warn("Erro ao excluir do Supabase, removido do cache local.");
  }
}
