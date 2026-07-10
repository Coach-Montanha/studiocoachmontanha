
CREATE TABLE IF NOT EXISTS public.pt_exercises_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  muscle_group text,
  description text,
  media_url text,
  media_type text,
  thumbnail_url text,
  is_global boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pt_exercises_library TO authenticated;
GRANT ALL ON public.pt_exercises_library TO service_role;

ALTER TABLE public.pt_exercises_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view own or global library"
  ON public.pt_exercises_library FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR is_global = true);

CREATE POLICY "insert own library"
  ON public.pt_exercises_library FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update own library"
  ON public.pt_exercises_library FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete own library"
  ON public.pt_exercises_library FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);


CREATE TABLE IF NOT EXISTS public.pt_training_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  training_day_id uuid NOT NULL REFERENCES public.pt_training_days(id) ON DELETE CASCADE,
  exercise_library_id uuid REFERENCES public.pt_exercises_library(id) ON DELETE SET NULL,
  name text NOT NULL,
  media_url text,
  media_type text DEFAULT 'image',
  thumbnail_url text,
  sets_reps text,
  load text,
  rest_seconds text,
  observations text,
  sort_order int NOT NULL DEFAULT 0,
  is_superset boolean NOT NULL DEFAULT false,
  superset_group text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pt_training_exercises_day_idx ON public.pt_training_exercises(training_day_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pt_training_exercises TO authenticated;
GRANT ALL ON public.pt_training_exercises TO service_role;

ALTER TABLE public.pt_training_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trainer manages own exercises"
  ON public.pt_training_exercises FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "student views own visible exercises"
  ON public.pt_training_exercises FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.pt_training_days d
      JOIN public.pt_programs p ON p.id = d.program_id
      JOIN public.pt_students s ON s.id = p.pt_student_id
      WHERE d.id = pt_training_exercises.training_day_id
        AND p.show_to_student = true
        AND p.is_archived = false
        AND p.is_deleted = false
        AND s.account_user_id = auth.uid()
    )
  );
