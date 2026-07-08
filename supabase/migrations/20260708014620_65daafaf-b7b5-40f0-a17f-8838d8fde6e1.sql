-- Keep student current plan synced from the latest paid payment with a plan.
CREATE OR REPLACE FUNCTION public.sync_student_plan_from_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_latest RECORD;
BEGIN
  -- Recalculate from the student's latest paid payment with a plan after any relevant change.
  SELECT p.user_id, p.student_id, p.plan_id, p.payment_date, p.created_at
    INTO v_latest
    FROM public.payments p
   WHERE p.student_id = NEW.student_id
     AND p.plan_id IS NOT NULL
     AND p.status = 'paid'
   ORDER BY p.payment_date DESC, p.created_at DESC
   LIMIT 1;

  IF v_latest.student_id IS NULL THEN
    UPDATE public.student_plan_history
       SET is_current = false,
           end_date = COALESCE(end_date, CURRENT_DATE)
     WHERE student_id = NEW.student_id
       AND is_current = true;
    RETURN NEW;
  END IF;

  UPDATE public.student_plan_history
     SET is_current = false,
         end_date = COALESCE(end_date, v_latest.payment_date)
   WHERE student_id = v_latest.student_id
     AND is_current = true
     AND (plan_id IS DISTINCT FROM v_latest.plan_id OR start_date IS DISTINCT FROM v_latest.payment_date);

  INSERT INTO public.student_plan_history (user_id, student_id, plan_id, start_date, end_date, is_current)
  SELECT v_latest.user_id, v_latest.student_id, v_latest.plan_id, v_latest.payment_date, NULL, true
  WHERE NOT EXISTS (
    SELECT 1
      FROM public.student_plan_history h
     WHERE h.student_id = v_latest.student_id
       AND h.plan_id = v_latest.plan_id
       AND h.start_date = v_latest.payment_date
       AND h.is_current = true
  );

  -- If multiple rows are current, keep only the newest one.
  WITH ranked AS (
    SELECT id,
           row_number() OVER (PARTITION BY student_id ORDER BY start_date DESC, created_at DESC, id DESC) AS rn
      FROM public.student_plan_history
     WHERE student_id = v_latest.student_id
       AND is_current = true
  )
  UPDATE public.student_plan_history h
     SET is_current = false,
         end_date = COALESCE(end_date, v_latest.payment_date)
    FROM ranked r
   WHERE h.id = r.id
     AND r.rn > 1;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_student_plan_from_payment ON public.payments;
CREATE TRIGGER trg_sync_student_plan_from_payment
AFTER INSERT OR UPDATE OF plan_id, status, payment_date, student_id ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.sync_student_plan_from_payment();

-- Rebuild current-plan history from latest paid payments so existing students are fixed too.
WITH latest AS (
  SELECT DISTINCT ON (student_id)
         user_id, student_id, plan_id, payment_date, created_at
    FROM public.payments
   WHERE plan_id IS NOT NULL
     AND status = 'paid'
   ORDER BY student_id, payment_date DESC, created_at DESC
)
UPDATE public.student_plan_history h
   SET is_current = false,
       end_date = COALESCE(end_date, l.payment_date)
  FROM latest l
 WHERE h.student_id = l.student_id
   AND h.is_current = true
   AND (h.plan_id IS DISTINCT FROM l.plan_id OR h.start_date IS DISTINCT FROM l.payment_date);

WITH latest AS (
  SELECT DISTINCT ON (student_id)
         user_id, student_id, plan_id, payment_date, created_at
    FROM public.payments
   WHERE plan_id IS NOT NULL
     AND status = 'paid'
   ORDER BY student_id, payment_date DESC, created_at DESC
)
INSERT INTO public.student_plan_history (user_id, student_id, plan_id, start_date, end_date, is_current)
SELECT l.user_id, l.student_id, l.plan_id, l.payment_date, NULL, true
  FROM latest l
 WHERE NOT EXISTS (
   SELECT 1
     FROM public.student_plan_history h
    WHERE h.student_id = l.student_id
      AND h.plan_id = l.plan_id
      AND h.start_date = l.payment_date
      AND h.is_current = true
 );

WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY student_id ORDER BY start_date DESC, created_at DESC, id DESC) AS rn
    FROM public.student_plan_history
   WHERE is_current = true
)
UPDATE public.student_plan_history h
   SET is_current = false,
       end_date = COALESCE(end_date, h.start_date)
  FROM ranked r
 WHERE h.id = r.id
   AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS student_plan_history_one_current_per_student
ON public.student_plan_history (student_id)
WHERE is_current = true;

-- Generate future sessions for active recurring classes that are missing from the agenda.
WITH class_days AS (
  SELECT c.id AS class_id,
         c.user_id,
         c.start_time,
         c.duration_minutes,
         unnest(COALESCE(NULLIF(c.days_of_week, '{}'::smallint[]), ARRAY[c.day_of_week]::smallint[]))::int AS dow
    FROM public.classes c
   WHERE c.is_active = true
     AND c.is_recurring = true
     AND COALESCE(array_length(COALESCE(NULLIF(c.days_of_week, '{}'::smallint[]), ARRAY[c.day_of_week]::smallint[]), 1), 0) > 0
), generated AS (
  SELECT cd.user_id,
         cd.class_id,
         (CURRENT_DATE + (((cd.dow - EXTRACT(DOW FROM CURRENT_DATE)::int + 7) % 7) + (week_no * 7)))::date AS session_date,
         cd.start_time,
         cd.duration_minutes
    FROM class_days cd
   CROSS JOIN generate_series(0, 11) AS week_no
)
INSERT INTO public.class_sessions (user_id, class_id, session_date, start_time, duration_minutes)
SELECT g.user_id, g.class_id, g.session_date, g.start_time, g.duration_minutes
  FROM generated g
 WHERE NOT EXISTS (
   SELECT 1
     FROM public.class_sessions cs
    WHERE cs.class_id = g.class_id
      AND cs.session_date = g.session_date
      AND cs.start_time = g.start_time
 );

-- Remove duplicated check-ins for the same student/session, keeping the earliest record.
WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY student_id, session_id ORDER BY created_at ASC, id ASC) AS rn
    FROM public.class_attendance
)
DELETE FROM public.class_attendance ca
 USING ranked r
 WHERE ca.id = r.id
   AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS class_attendance_unique_student_session
ON public.class_attendance (student_id, session_id);

-- Student-facing access rules needed after removing manual class enrollment.
DROP POLICY IF EXISTS "student reads own educator sessions" ON public.class_sessions;
CREATE POLICY "student reads own educator sessions"
ON public.class_sessions
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'student'::app_role)
  AND EXISTS (
    SELECT 1
      FROM public.students s
     WHERE s.account_user_id = auth.uid()
       AND s.user_id = class_sessions.user_id
  )
);

DROP POLICY IF EXISTS "student reads own educator active classes" ON public.classes;
CREATE POLICY "student reads own educator active classes"
ON public.classes
FOR SELECT
TO authenticated
USING (
  is_active
  AND public.has_role(auth.uid(), 'student'::app_role)
  AND EXISTS (
    SELECT 1
      FROM public.students s
     WHERE s.account_user_id = auth.uid()
       AND s.user_id = classes.user_id
  )
);

DROP POLICY IF EXISTS "student reads own educator programs" ON public.programs;
CREATE POLICY "student reads own educator programs"
ON public.programs
FOR SELECT
TO authenticated
USING (
  is_active
  AND public.has_role(auth.uid(), 'student'::app_role)
  AND EXISTS (
    SELECT 1
      FROM public.students s
     WHERE s.account_user_id = auth.uid()
       AND s.user_id = programs.user_id
  )
);

DROP POLICY IF EXISTS "student reads plan programs from own current plan" ON public.plan_programs;
CREATE POLICY "student reads plan programs from own current plan"
ON public.plan_programs
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'student'::app_role)
  AND EXISTS (
    SELECT 1
      FROM public.students s
      JOIN public.student_plan_history h ON h.student_id = s.id AND h.is_current = true
     WHERE s.account_user_id = auth.uid()
       AND s.user_id = plan_programs.user_id
       AND h.plan_id = plan_programs.plan_id
  )
);

DROP POLICY IF EXISTS "student reads own attendance" ON public.class_attendance;
CREATE POLICY "student reads own attendance"
ON public.class_attendance
FOR SELECT
TO authenticated
USING (
  student_id IN (
    SELECT id FROM public.students WHERE account_user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
      FROM public.students s
      JOIN public.class_sessions cs ON cs.id = class_attendance.session_id
     WHERE s.account_user_id = auth.uid()
       AND s.user_id = cs.user_id
  )
);