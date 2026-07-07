
-- Avatars: restrict SELECT to own folder
DROP POLICY IF EXISTS "Avatars: authenticated can read all" ON storage.objects;
CREATE POLICY "Avatars: users can read own files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

-- Plans: scope student reads to plans of their own educator
DROP POLICY IF EXISTS "student reads plans" ON public.plans;
CREATE POLICY "student reads own educator plans"
ON public.plans FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'student'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.account_user_id = auth.uid()
      AND s.user_id = plans.user_id
  )
);

-- Classes: scope student reads to classes of their own educator
DROP POLICY IF EXISTS "student reads active classes" ON public.classes;
CREATE POLICY "student reads own educator active classes"
ON public.classes FOR SELECT TO authenticated
USING (
  is_active
  AND has_role(auth.uid(), 'student'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.account_user_id = auth.uid()
      AND s.user_id = classes.user_id
  )
);

-- Enforce ownership consistency between payments and students
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_user_id_id_key;
ALTER TABLE public.students ADD CONSTRAINT students_user_id_id_key UNIQUE (user_id, id);
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_student_owner_fk;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_student_owner_fk
  FOREIGN KEY (user_id, student_id)
  REFERENCES public.students(user_id, id) ON DELETE CASCADE;

ALTER TABLE public.pt_students DROP CONSTRAINT IF EXISTS pt_students_user_id_id_key;
ALTER TABLE public.pt_students ADD CONSTRAINT pt_students_user_id_id_key UNIQUE (user_id, id);
ALTER TABLE public.pt_payments DROP CONSTRAINT IF EXISTS pt_payments_student_owner_fk;
ALTER TABLE public.pt_payments
  ADD CONSTRAINT pt_payments_student_owner_fk
  FOREIGN KEY (user_id, pt_student_id)
  REFERENCES public.pt_students(user_id, id) ON DELETE CASCADE;

-- Lock down SECURITY DEFINER functions from being called via the API
REVOKE ALL ON FUNCTION public.recalculate_student_status(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recalculate_pt_student_status(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trigger_recalculate_student_status() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trigger_recalculate_pt_student_status() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recalculate_all_student_statuses_for(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.recalculate_all_pt_student_statuses_for(uuid) FROM PUBLIC, anon;
