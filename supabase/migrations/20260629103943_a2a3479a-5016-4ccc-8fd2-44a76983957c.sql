-- Students status auto-calc
CREATE OR REPLACE FUNCTION public.recalculate_student_status(p_student_id uuid)
RETURNS void AS $$
DECLARE
  v_current_month text := to_char(now(), 'YYYY-MM');
  v_last_month text := to_char(now() - interval '1 month', 'YYYY-MM');
  v_paid_current bool;
  v_paid_last bool;
  v_new_status text;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.payments WHERE student_id = p_student_id AND status = 'paid' AND reference_month = v_current_month) INTO v_paid_current;
  SELECT EXISTS (SELECT 1 FROM public.payments WHERE student_id = p_student_id AND status = 'paid' AND reference_month = v_last_month) INTO v_paid_last;
  IF v_paid_current THEN
    v_new_status := 'active';
  ELSIF v_paid_last AND NOT v_paid_current THEN
    v_new_status := 'inactive';
  ELSIF NOT v_paid_last AND NOT v_paid_current THEN
    v_new_status := 'churned';
  ELSE
    v_new_status := 'inactive';
  END IF;
  UPDATE public.students SET status = v_new_status, updated_at = now() WHERE id = p_student_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.trigger_recalculate_student_status()
RETURNS trigger AS $$
DECLARE v_student_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN v_student_id := OLD.student_id; ELSE v_student_id := NEW.student_id; END IF;
  PERFORM public.recalculate_student_status(v_student_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_payment_change ON public.payments;
CREATE TRIGGER on_payment_change
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.trigger_recalculate_student_status();

CREATE OR REPLACE FUNCTION public.recalculate_all_student_statuses()
RETURNS void AS $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.students LOOP
    PERFORM public.recalculate_student_status(r.id);
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- PT students
CREATE OR REPLACE FUNCTION public.recalculate_pt_student_status(p_student_id uuid)
RETURNS void AS $$
DECLARE
  v_current_month text := to_char(now(), 'YYYY-MM');
  v_last_month text := to_char(now() - interval '1 month', 'YYYY-MM');
  v_paid_current bool;
  v_paid_last bool;
  v_new_status text;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.pt_payments WHERE pt_student_id = p_student_id AND status = 'paid' AND reference_month = v_current_month) INTO v_paid_current;
  SELECT EXISTS (SELECT 1 FROM public.pt_payments WHERE pt_student_id = p_student_id AND status = 'paid' AND reference_month = v_last_month) INTO v_paid_last;
  IF v_paid_current THEN
    v_new_status := 'active';
  ELSIF v_paid_last AND NOT v_paid_current THEN
    v_new_status := 'inactive';
  ELSIF NOT v_paid_last AND NOT v_paid_current THEN
    v_new_status := 'churned';
  ELSE
    v_new_status := 'inactive';
  END IF;
  UPDATE public.pt_students SET status = v_new_status, updated_at = now() WHERE id = p_student_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.trigger_recalculate_pt_student_status()
RETURNS trigger AS $$
DECLARE v_student_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN v_student_id := OLD.pt_student_id; ELSE v_student_id := NEW.pt_student_id; END IF;
  PERFORM public.recalculate_pt_student_status(v_student_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_pt_payment_change ON public.pt_payments;
CREATE TRIGGER on_pt_payment_change
  AFTER INSERT OR UPDATE OR DELETE ON public.pt_payments
  FOR EACH ROW EXECUTE FUNCTION public.trigger_recalculate_pt_student_status();

CREATE OR REPLACE FUNCTION public.recalculate_all_pt_student_statuses()
RETURNS void AS $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.pt_students LOOP
    PERFORM public.recalculate_pt_student_status(r.id);
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

SELECT public.recalculate_all_student_statuses();
SELECT public.recalculate_all_pt_student_statuses();