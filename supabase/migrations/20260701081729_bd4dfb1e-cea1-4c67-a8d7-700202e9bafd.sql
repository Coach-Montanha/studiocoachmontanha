
DROP FUNCTION IF EXISTS public.recalculate_all_student_statuses();
DROP FUNCTION IF EXISTS public.recalculate_all_pt_student_statuses();

CREATE OR REPLACE FUNCTION public.recalculate_all_student_statuses_for(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  r RECORD;
  v_current_month text := to_char(now(), 'YYYY-MM');
  v_last_month text := to_char(now() - interval '1 month', 'YYYY-MM');
  v_paid_current bool;
  v_paid_last bool;
  v_new_status text;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'user_id required'; END IF;
  FOR r IN SELECT id FROM public.students WHERE user_id = p_user_id LOOP
    SELECT EXISTS (SELECT 1 FROM public.payments WHERE student_id = r.id AND status = 'paid' AND reference_month = v_current_month) INTO v_paid_current;
    SELECT EXISTS (SELECT 1 FROM public.payments WHERE student_id = r.id AND status = 'paid' AND reference_month = v_last_month) INTO v_paid_last;
    IF v_paid_current THEN v_new_status := 'active';
    ELSIF v_paid_last AND NOT v_paid_current THEN v_new_status := 'inactive';
    ELSIF NOT v_paid_last AND NOT v_paid_current THEN v_new_status := 'churned';
    ELSE v_new_status := 'inactive';
    END IF;
    UPDATE public.students SET status = v_new_status, updated_at = now() WHERE id = r.id AND user_id = p_user_id;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_all_pt_student_statuses_for(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  r RECORD;
  v_current_month text := to_char(now(), 'YYYY-MM');
  v_last_month text := to_char(now() - interval '1 month', 'YYYY-MM');
  v_paid_current bool;
  v_paid_last bool;
  v_new_status text;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'user_id required'; END IF;
  FOR r IN SELECT id FROM public.pt_students WHERE user_id = p_user_id LOOP
    SELECT EXISTS (SELECT 1 FROM public.pt_payments WHERE pt_student_id = r.id AND status = 'paid' AND reference_month = v_current_month) INTO v_paid_current;
    SELECT EXISTS (SELECT 1 FROM public.pt_payments WHERE pt_student_id = r.id AND status = 'paid' AND reference_month = v_last_month) INTO v_paid_last;
    IF v_paid_current THEN v_new_status := 'active';
    ELSIF v_paid_last AND NOT v_paid_current THEN v_new_status := 'inactive';
    ELSIF NOT v_paid_last AND NOT v_paid_current THEN v_new_status := 'churned';
    ELSE v_new_status := 'inactive';
    END IF;
    UPDATE public.pt_students SET status = v_new_status, updated_at = now() WHERE id = r.id AND user_id = p_user_id;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.recalculate_all_student_statuses_for(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalculate_all_pt_student_statuses_for(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_all_student_statuses_for(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_all_pt_student_statuses_for(uuid) TO service_role;
