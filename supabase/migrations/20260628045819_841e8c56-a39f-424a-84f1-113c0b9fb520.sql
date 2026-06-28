
-- pt_students
CREATE TABLE public.pt_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  email text,
  phone text,
  birth_date date,
  goal text,
  health_notes text,
  status text NOT NULL DEFAULT 'active',
  start_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pt_students TO authenticated;
GRANT ALL ON public.pt_students TO service_role;
ALTER TABLE public.pt_students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own pt_students" ON public.pt_students FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- pt_plans
CREATE TABLE public.pt_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  sessions_per_month int,
  price_per_month numeric,
  price_per_session numeric,
  billing_type text NOT NULL DEFAULT 'monthly',
  package_sessions int,
  package_price numeric,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pt_plans TO authenticated;
GRANT ALL ON public.pt_plans TO service_role;
ALTER TABLE public.pt_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own pt_plans" ON public.pt_plans FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- pt_payments
CREATE TABLE public.pt_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  pt_student_id uuid NOT NULL REFERENCES public.pt_students(id) ON DELETE CASCADE,
  pt_plan_id uuid REFERENCES public.pt_plans(id) ON DELETE SET NULL,
  amount numeric NOT NULL,
  payment_date date NOT NULL,
  due_date date,
  reference_month text,
  payment_method text NOT NULL DEFAULT 'pix',
  status text NOT NULL DEFAULT 'paid',
  sessions_paid int,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pt_payments TO authenticated;
GRANT ALL ON public.pt_payments TO service_role;
ALTER TABLE public.pt_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own pt_payments" ON public.pt_payments FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- pt_sessions
CREATE TABLE public.pt_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  pt_student_id uuid NOT NULL REFERENCES public.pt_students(id) ON DELETE CASCADE,
  pt_payment_id uuid REFERENCES public.pt_payments(id) ON DELETE SET NULL,
  session_date date NOT NULL,
  session_time time,
  duration_minutes int NOT NULL DEFAULT 60,
  status text NOT NULL DEFAULT 'completed',
  exercises text,
  performance_notes text,
  next_session_plan text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pt_sessions TO authenticated;
GRANT ALL ON public.pt_sessions TO service_role;
ALTER TABLE public.pt_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own pt_sessions" ON public.pt_sessions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- updated_at triggers (function already exists)
CREATE TRIGGER pt_students_updated_at BEFORE UPDATE ON public.pt_students FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER pt_plans_updated_at BEFORE UPDATE ON public.pt_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER pt_payments_updated_at BEFORE UPDATE ON public.pt_payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER pt_sessions_updated_at BEFORE UPDATE ON public.pt_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- helpful indexes
CREATE INDEX pt_payments_student_idx ON public.pt_payments(pt_student_id);
CREATE INDEX pt_sessions_student_idx ON public.pt_sessions(pt_student_id);
CREATE INDEX pt_sessions_date_idx ON public.pt_sessions(session_date);
CREATE INDEX pt_payments_user_idx ON public.pt_payments(user_id);
CREATE INDEX pt_sessions_user_idx ON public.pt_sessions(user_id);
