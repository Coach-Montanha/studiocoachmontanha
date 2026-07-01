
REVOKE EXECUTE ON FUNCTION public.recalculate_all_student_statuses() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalculate_all_pt_student_statuses() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_all_student_statuses() TO service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_all_pt_student_statuses() TO service_role;
