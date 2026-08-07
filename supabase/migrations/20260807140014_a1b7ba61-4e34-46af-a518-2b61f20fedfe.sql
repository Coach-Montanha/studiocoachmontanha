DROP POLICY IF EXISTS "Trainers manage own pt_training_executions" ON public.pt_training_executions;
CREATE POLICY "Trainers manage own pt_training_executions"
ON public.pt_training_executions
FOR ALL
TO authenticated
USING (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM public.pt_students s
    WHERE s.id = pt_training_executions.pt_student_id
    AND s.user_id = auth.uid()
  )
)
WITH CHECK (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM public.pt_students s
    WHERE s.id = pt_training_executions.pt_student_id
    AND s.user_id = auth.uid()
  )
);
