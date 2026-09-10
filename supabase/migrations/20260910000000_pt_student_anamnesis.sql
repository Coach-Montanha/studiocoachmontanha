-- pt_student_anamnesis (Anamnese e Questionário de Prontidão PAR-Q)
CREATE TABLE IF NOT EXISTS public.pt_student_anamnesis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  pt_student_id uuid NOT NULL REFERENCES public.pt_students(id) ON DELETE CASCADE,
  
  -- Perguntas Internacionais PAR-Q (Physical Activity Readiness Questionnaire)
  parq_heart_condition boolean DEFAULT false,
  parq_chest_pain_activity boolean DEFAULT false,
  parq_chest_pain_rest boolean DEFAULT false,
  parq_dizziness boolean DEFAULT false,
  parq_bone_joint_problem boolean DEFAULT false,
  parq_blood_pressure_meds boolean DEFAULT false,
  parq_other_reason boolean DEFAULT false,
  
  -- Articulações e Lesões Ortopédicas
  joint_spine boolean DEFAULT false,
  joint_knee boolean DEFAULT false,
  joint_shoulder boolean DEFAULT false,
  joint_hip boolean DEFAULT false,
  joint_ankle boolean DEFAULT false,
  orthopedic_injuries text,
  
  -- Histórico Médico e Clínico
  medical_conditions text,
  surgeries text,
  medications text,
  
  -- Hábitos & Perfil
  sleep_hours numeric,
  stress_level text DEFAULT 'moderate',
  exercise_experience text DEFAULT 'iniciante',
  contraindications text,
  risk_level text NOT NULL DEFAULT 'low',
  notes text,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pt_student_anamnesis_student ON public.pt_student_anamnesis(pt_student_id);
CREATE INDEX IF NOT EXISTS idx_pt_student_anamnesis_user ON public.pt_student_anamnesis(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pt_student_anamnesis TO authenticated;
GRANT ALL ON public.pt_student_anamnesis TO service_role;
ALTER TABLE public.pt_student_anamnesis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users manage own pt_student_anamnesis" ON public.pt_student_anamnesis;
CREATE POLICY "users manage own pt_student_anamnesis" ON public.pt_student_anamnesis
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "pt_students self read anamnesis" ON public.pt_student_anamnesis;
CREATE POLICY "pt_students self read anamnesis" ON public.pt_student_anamnesis
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pt_students s
      WHERE s.id = pt_student_anamnesis.pt_student_id
        AND s.account_user_id = auth.uid()
    )
  );
