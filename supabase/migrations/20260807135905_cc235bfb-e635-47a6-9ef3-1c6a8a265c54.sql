GRANT INSERT, SELECT, UPDATE, DELETE ON public.pt_training_executions TO authenticated;
GRANT ALL ON public.pt_training_executions TO service_role;

DROP POLICY IF EXISTS "PT students can insert own training executions" ON public.pt_training_executions;

CREATE POLICY "PT students can insert own training executions"
ON public.pt_training_executions
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.pt_students s
    WHERE s.id = pt_training_executions.pt_student_id
    AND s.account_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "PT students view own pt_training_executions" ON public.pt_training_executions;
CREATE POLICY "PT students view own pt_training_executions"
ON public.pt_training_executions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.pt_students s
    WHERE s.id = pt_training_executions.pt_student_id
    AND s.account_user_id = auth.uid()
  )
);
