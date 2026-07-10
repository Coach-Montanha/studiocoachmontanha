
REVOKE ALL ON FUNCTION public.restore_student(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.restore_payment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_student(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_payment(uuid) TO authenticated;
