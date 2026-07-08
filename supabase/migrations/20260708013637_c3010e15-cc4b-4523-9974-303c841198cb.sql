
-- Allow students to see sessions from their studio (plan-based filtering happens in server code)
DROP POLICY IF EXISTS "student reads sessions of own classes" ON public.class_sessions;
CREATE POLICY "student reads own educator sessions"
ON public.class_sessions
FOR SELECT
USING (
  has_role(auth.uid(), 'student'::app_role) AND EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.account_user_id = auth.uid()
      AND s.user_id = class_sessions.user_id
  )
);

-- Allow students to check-in / cancel their own attendance
DROP POLICY IF EXISTS "student inserts own attendance" ON public.class_attendance;
CREATE POLICY "student inserts own attendance"
ON public.class_attendance
FOR INSERT
WITH CHECK (
  student_id IN (SELECT id FROM public.students WHERE account_user_id = auth.uid())
);

DROP POLICY IF EXISTS "student deletes own attendance" ON public.class_attendance;
CREATE POLICY "student deletes own attendance"
ON public.class_attendance
FOR DELETE
USING (
  student_id IN (SELECT id FROM public.students WHERE account_user_id = auth.uid())
);
