
-- Security Hardening Migration v2

-- 1. PT Students RLS
ALTER TABLE public.pt_students ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pt_students TO authenticated;
GRANT ALL ON public.pt_students TO service_role;

DROP POLICY IF EXISTS "Users can manage their own PT students" ON public.pt_students;
CREATE POLICY "Users can manage their own PT students"
ON public.pt_students
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 2. Announcements RLS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;

DROP POLICY IF EXISTS "Users can manage their own announcements" ON public.announcements;
CREATE POLICY "Users can manage their own announcements"
ON public.announcements
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 3. Class Attendance RLS (Prevent cross-trainer check-ins)
ALTER TABLE public.class_attendance ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_attendance TO authenticated;
GRANT ALL ON public.class_attendance TO service_role;

DROP POLICY IF EXISTS "Students can only check-in to sessions they are linked to" ON public.class_attendance;
CREATE POLICY "Students can only check-in to sessions they are linked to"
ON public.class_attendance
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.class_sessions s
    JOIN public.students st ON st.user_id = s.user_id
    WHERE s.id = class_attendance.session_id
      AND st.account_user_id = auth.uid()
  )
);

-- 4. User Email Settings RLS (Ensuring it exists and is scoped)
-- The table was created in the failed migration (or part of it)
ALTER TABLE public.user_email_settings ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_email_settings TO authenticated;
GRANT ALL ON public.user_email_settings TO service_role;

DROP POLICY IF EXISTS "Users can manage their own email settings" ON public.user_email_settings;
CREATE POLICY "Users can manage their own email settings"
ON public.user_email_settings
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
