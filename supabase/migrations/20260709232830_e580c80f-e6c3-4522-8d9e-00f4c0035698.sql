
-- 1) Campos novos no cadastro de aluno PT
ALTER TABLE public.pt_students
  ADD COLUMN IF NOT EXISTS temp_password text,
  ADD COLUMN IF NOT EXISTS training_plan text;

-- 2) Políticas RLS: aluno PT autenticado lê a própria linha e seus dados
DROP POLICY IF EXISTS "PT student can view own row" ON public.pt_students;
CREATE POLICY "PT student can view own row"
  ON public.pt_students
  FOR SELECT
  TO authenticated
  USING (account_user_id = auth.uid());

DROP POLICY IF EXISTS "PT student can view own sessions" ON public.pt_sessions;
CREATE POLICY "PT student can view own sessions"
  ON public.pt_sessions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pt_students s
      WHERE s.id = pt_sessions.pt_student_id
        AND s.account_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "PT student can view own payments" ON public.pt_payments;
CREATE POLICY "PT student can view own payments"
  ON public.pt_payments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pt_students s
      WHERE s.id = pt_payments.pt_student_id
        AND s.account_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "PT student can view plans of own payments" ON public.pt_plans;
CREATE POLICY "PT student can view plans of own payments"
  ON public.pt_plans
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pt_payments p
      JOIN public.pt_students s ON s.id = p.pt_student_id
      WHERE p.pt_plan_id = pt_plans.id
        AND s.account_user_id = auth.uid()
    )
  );
