-- Lock down SECURITY DEFINER functions: revoke public EXECUTE and grant narrowly.

REVOKE ALL ON FUNCTION public.recalculate_student_status(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recalculate_pt_student_status(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trigger_recalculate_student_status() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trigger_recalculate_pt_student_status() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.recalculate_all_student_statuses() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.recalculate_all_pt_student_statuses() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recalculate_all_student_statuses() TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_all_pt_student_statuses() TO authenticated;
