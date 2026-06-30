CREATE OR REPLACE FUNCTION public.recalculate_all_student_statuses()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r RECORD;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  FOR r IN SELECT id FROM public.students WHERE user_id = v_uid LOOP
    PERFORM public.recalculate_student_status(r.id);
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.recalculate_all_pt_student_statuses()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r RECORD;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  FOR r IN SELECT id FROM public.pt_students WHERE user_id = v_uid LOOP
    PERFORM public.recalculate_pt_student_status(r.id);
  END LOOP;
END;
$function$;