
-- pt_programs
CREATE TABLE public.pt_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pt_student_id uuid NOT NULL REFERENCES public.pt_students(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date,
  goals text,
  category text NOT NULL DEFAULT 'general',
  level text NOT NULL DEFAULT 'intermediate',
  training_type text NOT NULL DEFAULT 'numeric',
  show_to_student boolean NOT NULL DEFAULT true,
  auto_archive boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  is_archived boolean NOT NULL DEFAULT false,
  is_deleted boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pt_programs TO authenticated;
GRANT ALL ON public.pt_programs TO service_role;

ALTER TABLE public.pt_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trainers manage own pt_programs"
  ON public.pt_programs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "PT students view own visible pt_programs"
  ON public.pt_programs FOR SELECT
  USING (
    show_to_student = true
    AND is_archived = false
    AND is_deleted = false
    AND EXISTS (
      SELECT 1 FROM public.pt_students s
      WHERE s.id = pt_programs.pt_student_id
        AND s.account_user_id = auth.uid()
    )
  );

CREATE TRIGGER update_pt_programs_updated_at
  BEFORE UPDATE ON public.pt_programs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX pt_programs_student_idx ON public.pt_programs(pt_student_id);

-- pt_training_days
CREATE TABLE public.pt_training_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES public.pt_programs(id) ON DELETE CASCADE,
  name text NOT NULL,
  day_label text NOT NULL,
  description text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pt_training_days TO authenticated;
GRANT ALL ON public.pt_training_days TO service_role;

ALTER TABLE public.pt_training_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trainers manage own pt_training_days"
  ON public.pt_training_days FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "PT students view own pt_training_days"
  ON public.pt_training_days FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.pt_programs p
      JOIN public.pt_students s ON s.id = p.pt_student_id
      WHERE p.id = pt_training_days.program_id
        AND s.account_user_id = auth.uid()
        AND p.show_to_student = true
        AND p.is_archived = false
        AND p.is_deleted = false
    )
  );

CREATE TRIGGER update_pt_training_days_updated_at
  BEFORE UPDATE ON public.pt_training_days
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX pt_training_days_program_idx ON public.pt_training_days(program_id);

-- pt_training_executions
CREATE TABLE public.pt_training_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  training_day_id uuid NOT NULL REFERENCES public.pt_training_days(id) ON DELETE CASCADE,
  pt_student_id uuid NOT NULL REFERENCES public.pt_students(id) ON DELETE CASCADE,
  executed_at date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  feedback text,
  rating int CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pt_training_executions TO authenticated;
GRANT ALL ON public.pt_training_executions TO service_role;

ALTER TABLE public.pt_training_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trainers manage own pt_training_executions"
  ON public.pt_training_executions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "PT students view own pt_training_executions"
  ON public.pt_training_executions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.pt_students s
      WHERE s.id = pt_training_executions.pt_student_id
        AND s.account_user_id = auth.uid()
    )
  );

CREATE INDEX pt_training_executions_student_idx ON public.pt_training_executions(pt_student_id);
CREATE INDEX pt_training_executions_day_idx ON public.pt_training_executions(training_day_id);
