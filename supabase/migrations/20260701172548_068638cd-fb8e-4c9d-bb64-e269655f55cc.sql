
CREATE OR REPLACE FUNCTION public.recalculate_student_status(p_student_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_paid_date date;
  v_days_since int;
  v_new_status text;
BEGIN
  SELECT MAX(payment_date::date)
    INTO v_last_paid_date
  FROM public.payments
  WHERE student_id = p_student_id AND status = 'paid';

  IF v_last_paid_date IS NULL THEN
    v_new_status := 'churned';
  ELSE
    v_days_since := CURRENT_DATE - v_last_paid_date;
    IF v_days_since <= 30 THEN
      v_new_status := 'active';
    ELSIF v_days_since <= 60 THEN
      v_new_status := 'inactive';
    ELSE
      v_new_status := 'churned';
    END IF;
  END IF;

  UPDATE public.students
     SET status = v_new_status, updated_at = now()
   WHERE id = p_student_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_pt_student_status(p_student_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_paid_date date;
  v_days_since int;
  v_new_status text;
BEGIN
  SELECT MAX(payment_date::date)
    INTO v_last_paid_date
  FROM public.pt_payments
  WHERE pt_student_id = p_student_id AND status = 'paid';

  IF v_last_paid_date IS NULL THEN
    v_new_status := 'churned';
  ELSE
    v_days_since := CURRENT_DATE - v_last_paid_date;
    IF v_days_since <= 30 THEN
      v_new_status := 'active';
    ELSIF v_days_since <= 60 THEN
      v_new_status := 'inactive';
    ELSE
      v_new_status := 'churned';
    END IF;
  END IF;

  UPDATE public.pt_students
     SET status = v_new_status, updated_at = now()
   WHERE id = p_student_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_all_student_statuses_for(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_last_paid_date date;
  v_days_since int;
  v_new_status text;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'user_id required'; END IF;
  FOR r IN SELECT id FROM public.students WHERE user_id = p_user_id LOOP
    SELECT MAX(payment_date::date) INTO v_last_paid_date
      FROM public.payments WHERE student_id = r.id AND status = 'paid';
    IF v_last_paid_date IS NULL THEN
      v_new_status := 'churned';
    ELSE
      v_days_since := CURRENT_DATE - v_last_paid_date;
      IF v_days_since <= 30 THEN v_new_status := 'active';
      ELSIF v_days_since <= 60 THEN v_new_status := 'inactive';
      ELSE v_new_status := 'churned';
      END IF;
    END IF;
    UPDATE public.students SET status = v_new_status, updated_at = now()
     WHERE id = r.id AND user_id = p_user_id;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_all_pt_student_statuses_for(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_last_paid_date date;
  v_days_since int;
  v_new_status text;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'user_id required'; END IF;
  FOR r IN SELECT id FROM public.pt_students WHERE user_id = p_user_id LOOP
    SELECT MAX(payment_date::date) INTO v_last_paid_date
      FROM public.pt_payments WHERE pt_student_id = r.id AND status = 'paid';
    IF v_last_paid_date IS NULL THEN
      v_new_status := 'churned';
    ELSE
      v_days_since := CURRENT_DATE - v_last_paid_date;
      IF v_days_since <= 30 THEN v_new_status := 'active';
      ELSIF v_days_since <= 60 THEN v_new_status := 'inactive';
      ELSE v_new_status := 'churned';
      END IF;
    END IF;
    UPDATE public.pt_students SET status = v_new_status, updated_at = now()
     WHERE id = r.id AND user_id = p_user_id;
  END LOOP;
END;
$$;

-- Refresh all existing student statuses now (per-user loop to respect security scoping)
DO $$
DECLARE u RECORD;
BEGIN
  FOR u IN SELECT DISTINCT user_id FROM public.students LOOP
    PERFORM public.recalculate_all_student_statuses_for(u.user_id);
  END LOOP;
  FOR u IN SELECT DISTINCT user_id FROM public.pt_students LOOP
    PERFORM public.recalculate_all_pt_student_statuses_for(u.user_id);
  END LOOP;
END $$;
