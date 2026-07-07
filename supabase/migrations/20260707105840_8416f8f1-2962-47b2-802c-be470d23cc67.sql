
-- ROLES
DO $$ BEGIN CREATE TYPE public.app_role AS ENUM ('admin','student'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users
ON CONFLICT (user_id, role) DO NOTHING;

-- LINK STUDENT ACCOUNT
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS account_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.pt_students ADD COLUMN IF NOT EXISTS account_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_students_account_user ON public.students(account_user_id);
CREATE INDEX IF NOT EXISTS idx_pt_students_account_user ON public.pt_students(account_user_id);

-- CLASSES TABLES (create all first, add cross-referencing policies after)
CREATE TABLE IF NOT EXISTS public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  trainer_name text,
  day_of_week smallint,
  start_time time NOT NULL,
  duration_minutes int NOT NULL DEFAULT 60,
  capacity int NOT NULL DEFAULT 10,
  is_recurring boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes TO authenticated;
GRANT ALL ON public.classes TO service_role;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.class_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE,
  session_date date NOT NULL,
  start_time time NOT NULL,
  duration_minutes int NOT NULL DEFAULT 60,
  capacity_override int,
  status text NOT NULL DEFAULT 'scheduled',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_sessions TO authenticated;
GRANT ALL ON public.class_sessions TO service_role;
ALTER TABLE public.class_sessions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.class_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(class_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_enrollments TO authenticated;
GRANT ALL ON public.class_enrollments TO service_role;
ALTER TABLE public.class_enrollments ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.class_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_id uuid NOT NULL REFERENCES public.class_sessions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'present',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_attendance TO authenticated;
GRANT ALL ON public.class_attendance TO service_role;
ALTER TABLE public.class_attendance ENABLE ROW LEVEL SECURITY;

-- POLICIES
DROP POLICY IF EXISTS "read own roles" ON public.user_roles;
CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "student reads own profile" ON public.students;
CREATE POLICY "student reads own profile" ON public.students FOR SELECT TO authenticated
  USING (account_user_id = auth.uid());

DROP POLICY IF EXISTS "student reads own payments" ON public.payments;
CREATE POLICY "student reads own payments" ON public.payments FOR SELECT TO authenticated
  USING (student_id IN (SELECT id FROM public.students WHERE account_user_id = auth.uid()));

DROP POLICY IF EXISTS "student reads own plan history" ON public.student_plan_history;
CREATE POLICY "student reads own plan history" ON public.student_plan_history FOR SELECT TO authenticated
  USING (student_id IN (SELECT id FROM public.students WHERE account_user_id = auth.uid()));

DROP POLICY IF EXISTS "student reads plans" ON public.plans;
CREATE POLICY "student reads plans" ON public.plans FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'student'));

DROP POLICY IF EXISTS "admin manages classes" ON public.classes;
CREATE POLICY "admin manages classes" ON public.classes FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "student reads active classes" ON public.classes;
CREATE POLICY "student reads active classes" ON public.classes FOR SELECT TO authenticated
  USING (is_active AND public.has_role(auth.uid(), 'student'));

DROP POLICY IF EXISTS "admin manages sessions" ON public.class_sessions;
CREATE POLICY "admin manages sessions" ON public.class_sessions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "student reads sessions of own classes" ON public.class_sessions;
CREATE POLICY "student reads sessions of own classes" ON public.class_sessions FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'student') AND
    class_id IN (
      SELECT ce.class_id FROM public.class_enrollments ce
      JOIN public.students s ON s.id = ce.student_id
      WHERE s.account_user_id = auth.uid() AND ce.active
    )
  );

DROP POLICY IF EXISTS "admin manages enrollments" ON public.class_enrollments;
CREATE POLICY "admin manages enrollments" ON public.class_enrollments FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "student reads own enrollments" ON public.class_enrollments;
CREATE POLICY "student reads own enrollments" ON public.class_enrollments FOR SELECT TO authenticated
  USING (student_id IN (SELECT id FROM public.students WHERE account_user_id = auth.uid()));
DROP POLICY IF EXISTS "student self-enroll" ON public.class_enrollments;
CREATE POLICY "student self-enroll" ON public.class_enrollments FOR INSERT TO authenticated
  WITH CHECK (student_id IN (SELECT id FROM public.students WHERE account_user_id = auth.uid()));
DROP POLICY IF EXISTS "student self-cancel" ON public.class_enrollments;
CREATE POLICY "student self-cancel" ON public.class_enrollments FOR UPDATE TO authenticated
  USING (student_id IN (SELECT id FROM public.students WHERE account_user_id = auth.uid()))
  WITH CHECK (student_id IN (SELECT id FROM public.students WHERE account_user_id = auth.uid()));
DROP POLICY IF EXISTS "student self-delete-enroll" ON public.class_enrollments;
CREATE POLICY "student self-delete-enroll" ON public.class_enrollments FOR DELETE TO authenticated
  USING (student_id IN (SELECT id FROM public.students WHERE account_user_id = auth.uid()));

DROP POLICY IF EXISTS "admin manages attendance" ON public.class_attendance;
CREATE POLICY "admin manages attendance" ON public.class_attendance FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "student reads own attendance" ON public.class_attendance;
CREATE POLICY "student reads own attendance" ON public.class_attendance FOR SELECT TO authenticated
  USING (student_id IN (SELECT id FROM public.students WHERE account_user_id = auth.uid()));

-- TRIGGERS
DROP TRIGGER IF EXISTS trg_classes_updated ON public.classes;
CREATE TRIGGER trg_classes_updated BEFORE UPDATE ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_class_sessions_updated ON public.class_sessions;
CREATE TRIGGER trg_class_sessions_updated BEFORE UPDATE ON public.class_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
