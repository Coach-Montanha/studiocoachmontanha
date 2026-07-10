
-- 1) Add super_admin to app_role enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'super_admin'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'super_admin';
  END IF;
END $$;

-- 2) Module enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_module') THEN
    CREATE TYPE public.app_module AS ENUM ('studio','pt','financeiro','crm');
  END IF;
END $$;

-- 3) user_modules table
CREATE TABLE IF NOT EXISTS public.user_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module public.app_module NOT NULL,
  active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, module)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_modules TO authenticated;
GRANT ALL ON public.user_modules TO service_role;

ALTER TABLE public.user_modules ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_user_modules_updated_at ON public.user_modules;
CREATE TRIGGER trg_user_modules_updated_at
  BEFORE UPDATE ON public.user_modules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Helpers — compare role::text to sidestep "new enum value not committed" rule
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_module(_user_id uuid, _module public.app_module)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.is_super_admin(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.user_modules
      WHERE user_id = _user_id
        AND module = _module
        AND active = true
        AND (expires_at IS NULL OR expires_at > now())
    );
$$;

-- 5) Policies on user_modules
DROP POLICY IF EXISTS "Users view own modules" ON public.user_modules;
CREATE POLICY "Users view own modules" ON public.user_modules
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Super admin manages modules" ON public.user_modules;
CREATE POLICY "Super admin manages modules" ON public.user_modules
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- 6) Super admin READ policies on all tenant tables
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'students','pt_students','payments','pt_payments','plans','pt_plans',
    'programs','pt_programs','plan_programs','classes','class_sessions',
    'class_attendance','class_enrollments','expenses','expense_categories',
    'announcements','notifications','payment_methods','pt_exercises_library',
    'pt_sessions','pt_student_contracts','pt_training_days',
    'pt_training_executions','pt_training_exercises','student_contracts',
    'student_plan_history','studio_settings','user_email_settings','user_roles'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Super admin can read all" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "Super admin can read all" ON public.%I FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()))',
      t
    );
  END LOOP;
END $$;
