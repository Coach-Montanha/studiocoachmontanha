CREATE OR REPLACE FUNCTION public.recalculate_all_student_statuses()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  r RECORD;
  v_uid uuid := auth.uid();
  v_current_month text := to_char(now(), 'YYYY-MM');
  v_last_month text := to_char(now() - interval '1 month', 'YYYY-MM');
  v_paid_current bool;
  v_paid_last bool;
  v_new_status text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  FOR r IN SELECT id FROM public.students WHERE user_id = v_uid LOOP
    SELECT EXISTS (SELECT 1 FROM public.payments WHERE student_id = r.id AND status = 'paid' AND reference_month = v_current_month) INTO v_paid_current;
    SELECT EXISTS (SELECT 1 FROM public.payments WHERE student_id = r.id AND status = 'paid' AND reference_month = v_last_month) INTO v_paid_last;
    IF v_paid_current THEN v_new_status := 'active';
    ELSIF v_paid_last AND NOT v_paid_current THEN v_new_status := 'inactive';
    ELSIF NOT v_paid_last AND NOT v_paid_current THEN v_new_status := 'churned';
    ELSE v_new_status := 'inactive';
    END IF;
    UPDATE public.students SET status = v_new_status, updated_at = now() WHERE id = r.id AND user_id = v_uid;
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.recalculate_all_pt_student_statuses()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  r RECORD;
  v_uid uuid := auth.uid();
  v_current_month text := to_char(now(), 'YYYY-MM');
  v_last_month text := to_char(now() - interval '1 month', 'YYYY-MM');
  v_paid_current bool;
  v_paid_last bool;
  v_new_status text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  FOR r IN SELECT id FROM public.pt_students WHERE user_id = v_uid LOOP
    SELECT EXISTS (SELECT 1 FROM public.pt_payments WHERE pt_student_id = r.id AND status = 'paid' AND reference_month = v_current_month) INTO v_paid_current;
    SELECT EXISTS (SELECT 1 FROM public.pt_payments WHERE pt_student_id = r.id AND status = 'paid' AND reference_month = v_last_month) INTO v_paid_last;
    IF v_paid_current THEN v_new_status := 'active';
    ELSIF v_paid_last AND NOT v_paid_current THEN v_new_status := 'inactive';
    ELSIF NOT v_paid_last AND NOT v_paid_current THEN v_new_status := 'churned';
    ELSE v_new_status := 'inactive';
    END IF;
    UPDATE public.pt_students SET status = v_new_status, updated_at = now() WHERE id = r.id AND user_id = v_uid;
  END LOOP;
END;
$function$;