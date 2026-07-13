-- Remove the SECURITY DEFINER views from previous migration
DROP VIEW IF EXISTS public.students_self;
DROP VIEW IF EXISTS public.pt_students_self;

-- Restore the students / pt_students self-read policies (rows the linked student may see)
CREATE POLICY "student reads own profile"
  ON public.students FOR SELECT
  TO authenticated
  USING (account_user_id = auth.uid() AND deleted_at IS NULL);

CREATE POLICY "PT student can view own row"
  ON public.pt_students FOR SELECT
  TO authenticated
  USING (account_user_id = auth.uid() AND deleted_at IS NULL);

-- Column-level: no signed-in user can read temp_password directly.
-- Tenant owners fetch it via the SECURITY DEFINER RPC below.
REVOKE SELECT (temp_password) ON public.students FROM authenticated, anon;
REVOKE SELECT (temp_password) ON public.pt_students FROM authenticated, anon;

-- RPCs: only the tenant owner (user_id = auth.uid()) may fetch a student's temp_password.
CREATE OR REPLACE FUNCTION public.get_student_credentials(_student_id uuid)
RETURNS TABLE(email text, temp_password text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT s.email, s.temp_password
    FROM public.students s
    WHERE s.id = _student_id
      AND s.user_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.get_pt_student_credentials(_student_id uuid)
RETURNS TABLE(email text, temp_password text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT s.email, s.temp_password
    FROM public.pt_students s
    WHERE s.id = _student_id
      AND s.user_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.get_student_credentials(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_pt_student_credentials(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_student_credentials(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pt_student_credentials(uuid) TO authenticated;
