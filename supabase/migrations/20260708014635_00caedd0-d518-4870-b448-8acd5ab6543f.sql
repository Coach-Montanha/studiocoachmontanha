REVOKE EXECUTE ON FUNCTION public.sync_student_plan_from_payment() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_student_plan_from_payment() TO service_role;