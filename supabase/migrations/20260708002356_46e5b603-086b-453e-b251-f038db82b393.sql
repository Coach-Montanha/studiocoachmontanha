
-- Function to sync student_plan_history from paid payments
CREATE OR REPLACE FUNCTION public.sync_student_plan_from_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.plan_id IS NULL OR NEW.status <> 'paid' THEN
    RETURN NEW;
  END IF;

  -- Mark previous current plan(s) for this student as not current
  UPDATE public.student_plan_history
     SET is_current = false,
         end_date = COALESCE(end_date, NEW.payment_date)
   WHERE student_id = NEW.student_id
     AND is_current = true
     AND plan_id <> NEW.plan_id;

  -- Upsert current row for (student, plan)
  IF EXISTS (
    SELECT 1 FROM public.student_plan_history
     WHERE student_id = NEW.student_id AND plan_id = NEW.plan_id
  ) THEN
    UPDATE public.student_plan_history
       SET is_current = true,
           end_date = NULL,
           start_date = LEAST(start_date, NEW.payment_date)
     WHERE student_id = NEW.student_id AND plan_id = NEW.plan_id;
  ELSE
    INSERT INTO public.student_plan_history (user_id, student_id, plan_id, start_date, is_current)
    VALUES (NEW.user_id, NEW.student_id, NEW.plan_id, NEW.payment_date, true);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_student_plan_from_payment ON public.payments;
CREATE TRIGGER trg_sync_student_plan_from_payment
AFTER INSERT OR UPDATE OF plan_id, status, payment_date ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.sync_student_plan_from_payment();

-- Backfill from existing paid payments (latest paid payment with plan per student wins)
WITH latest AS (
  SELECT DISTINCT ON (student_id)
         user_id, student_id, plan_id, payment_date
    FROM public.payments
   WHERE plan_id IS NOT NULL AND status = 'paid'
   ORDER BY student_id, payment_date DESC, created_at DESC
)
INSERT INTO public.student_plan_history (user_id, student_id, plan_id, start_date, is_current)
SELECT l.user_id, l.student_id, l.plan_id, l.payment_date, true
  FROM latest l
ON CONFLICT DO NOTHING;

-- Ensure only one current row per student
WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY student_id ORDER BY start_date DESC, created_at DESC) AS rn
    FROM public.student_plan_history
   WHERE is_current = true
)
UPDATE public.student_plan_history h
   SET is_current = false
  FROM ranked r
 WHERE h.id = r.id AND r.rn > 1;

-- For students whose latest paid payment plan differs from their current history row, promote it
WITH latest AS (
  SELECT DISTINCT ON (student_id)
         student_id, plan_id, payment_date
    FROM public.payments
   WHERE plan_id IS NOT NULL AND status = 'paid'
   ORDER BY student_id, payment_date DESC, created_at DESC
)
UPDATE public.student_plan_history h
   SET is_current = true
  FROM latest l
 WHERE h.student_id = l.student_id
   AND h.plan_id = l.plan_id
   AND h.is_current = false
   AND NOT EXISTS (
     SELECT 1 FROM public.student_plan_history h2
      WHERE h2.student_id = l.student_id AND h2.plan_id = l.plan_id AND h2.is_current = true
   );
