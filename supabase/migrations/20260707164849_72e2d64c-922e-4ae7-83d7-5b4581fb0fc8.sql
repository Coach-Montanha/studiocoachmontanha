
-- Drop redundant composite FKs that caused PostgREST embed ambiguity
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_student_owner_fk;
ALTER TABLE public.pt_payments DROP CONSTRAINT IF EXISTS pt_payments_student_owner_fk;

-- Move ownership guard inside the SECURITY DEFINER trigger functions
CREATE OR REPLACE FUNCTION public.recalculate_student_status(p_student_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_last_paid_date date;
  v_days_since int;
  v_new_status text;
  v_owner uuid;
BEGIN
  SELECT user_id INTO v_owner FROM public.students WHERE id = p_student_id;
  IF v_owner IS NULL THEN RETURN; END IF;
  -- Only allow the owner to trigger recalculation (auth.uid() is NULL for service_role)
  IF auth.uid() IS NOT NULL AND v_owner <> auth.uid() THEN RETURN; END IF;

  SELECT MAX(payment_date::date) INTO v_last_paid_date
  FROM public.payments WHERE student_id = p_student_id AND status = 'paid';

  IF v_last_paid_date IS NULL THEN v_new_status := 'churned';
  ELSE
    v_days_since := CURRENT_DATE - v_last_paid_date;
    IF v_days_since <= 30 THEN v_new_status := 'active';
    ELSIF v_days_since <= 60 THEN v_new_status := 'inactive';
    ELSE v_new_status := 'churned';
    END IF;
  END IF;

  UPDATE public.students SET status = v_new_status, updated_at = now() WHERE id = p_student_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.recalculate_pt_student_status(p_student_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_last_paid_date date;
  v_days_since int;
  v_new_status text;
  v_owner uuid;
BEGIN
  SELECT user_id INTO v_owner FROM public.pt_students WHERE id = p_student_id;
  IF v_owner IS NULL THEN RETURN; END IF;
  IF auth.uid() IS NOT NULL AND v_owner <> auth.uid() THEN RETURN; END IF;

  SELECT MAX(payment_date::date) INTO v_last_paid_date
  FROM public.pt_payments WHERE pt_student_id = p_student_id AND status = 'paid';

  IF v_last_paid_date IS NULL THEN v_new_status := 'churned';
  ELSE
    v_days_since := CURRENT_DATE - v_last_paid_date;
    IF v_days_since <= 30 THEN v_new_status := 'active';
    ELSIF v_days_since <= 60 THEN v_new_status := 'inactive';
    ELSE v_new_status := 'churned';
    END IF;
  END IF;

  UPDATE public.pt_students SET status = v_new_status, updated_at = now() WHERE id = p_student_id;
END;
$function$;
