CREATE TABLE IF NOT EXISTS public.student_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size int,
  file_type text,
  notes text,
  signed_at date,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_contracts TO authenticated;
GRANT ALL ON public.student_contracts TO service_role;
ALTER TABLE public.student_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own contracts" ON public.student_contracts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.pt_student_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  pt_student_id uuid NOT NULL REFERENCES public.pt_students(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size int,
  file_type text,
  notes text,
  signed_at date,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pt_student_contracts TO authenticated;
GRANT ALL ON public.pt_student_contracts TO service_role;
ALTER TABLE public.pt_student_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own pt contracts" ON public.pt_student_contracts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);