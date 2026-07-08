
-- class_attendance: student insert/delete
DROP POLICY IF EXISTS "student inserts own attendance" ON public.class_attendance;
CREATE POLICY "student inserts own attendance" ON public.class_attendance
  FOR INSERT TO authenticated
  WITH CHECK (student_id IN (SELECT id FROM public.students WHERE account_user_id = auth.uid()));

DROP POLICY IF EXISTS "student deletes own attendance" ON public.class_attendance;
CREATE POLICY "student deletes own attendance" ON public.class_attendance
  FOR DELETE TO authenticated
  USING (student_id IN (SELECT id FROM public.students WHERE account_user_id = auth.uid()));

-- expense_categories
DROP POLICY IF EXISTS "Users manage own expense categories" ON public.expense_categories;
CREATE POLICY "Users manage own expense categories" ON public.expense_categories
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- expenses
DROP POLICY IF EXISTS "Users manage own expenses" ON public.expenses;
CREATE POLICY "Users manage own expenses" ON public.expenses
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- payments
DROP POLICY IF EXISTS "users manage own payments" ON public.payments;
CREATE POLICY "users manage own payments" ON public.payments
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- plan_programs
DROP POLICY IF EXISTS "Users manage their own plan_programs" ON public.plan_programs;
CREATE POLICY "Users manage their own plan_programs" ON public.plan_programs
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- plans
DROP POLICY IF EXISTS "users manage own plans" ON public.plans;
CREATE POLICY "users manage own plans" ON public.plans
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- pt_payments
DROP POLICY IF EXISTS "users manage own pt_payments" ON public.pt_payments;
CREATE POLICY "users manage own pt_payments" ON public.pt_payments
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- pt_plans
DROP POLICY IF EXISTS "users manage own pt_plans" ON public.pt_plans;
CREATE POLICY "users manage own pt_plans" ON public.pt_plans
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- pt_sessions
DROP POLICY IF EXISTS "users manage own pt_sessions" ON public.pt_sessions;
CREATE POLICY "users manage own pt_sessions" ON public.pt_sessions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- pt_student_contracts
DROP POLICY IF EXISTS "users manage own pt contracts" ON public.pt_student_contracts;
CREATE POLICY "users manage own pt contracts" ON public.pt_student_contracts
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- pt_students
DROP POLICY IF EXISTS "users manage own pt_students" ON public.pt_students;
CREATE POLICY "users manage own pt_students" ON public.pt_students
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- student_contracts
DROP POLICY IF EXISTS "users manage own contracts" ON public.student_contracts;
CREATE POLICY "users manage own contracts" ON public.student_contracts
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- student_plan_history
DROP POLICY IF EXISTS "users manage own history" ON public.student_plan_history;
CREATE POLICY "users manage own history" ON public.student_plan_history
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- students
DROP POLICY IF EXISTS "users manage own students" ON public.students;
CREATE POLICY "users manage own students" ON public.students
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
