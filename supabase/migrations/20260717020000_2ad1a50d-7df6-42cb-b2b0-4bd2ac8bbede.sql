
REVOKE SELECT (temp_password) ON public.students FROM authenticated, anon;
REVOKE SELECT (temp_password) ON public.pt_students FROM authenticated, anon;
GRANT SELECT (temp_password) ON public.students TO service_role;
GRANT SELECT (temp_password) ON public.pt_students TO service_role;
