-- Revoke direct API execution of SECURITY DEFINER helpers.
-- Triggers still run them (owner privileges) and server functions still call them via service_role.
REVOKE ALL ON FUNCTION public.recalculate_student_status(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recalculate_pt_student_status(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trigger_recalculate_student_status() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trigger_recalculate_pt_student_status() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recalculate_all_student_statuses_for(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recalculate_all_pt_student_statuses_for(uuid) FROM PUBLIC, anon, authenticated;

-- has_role is used inside RLS policies, so authenticated MUST retain EXECUTE.
-- Anon has no policies that call it, so revoke there.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;