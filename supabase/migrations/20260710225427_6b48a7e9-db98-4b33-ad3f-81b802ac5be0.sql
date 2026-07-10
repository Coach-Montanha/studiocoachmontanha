DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'announcements','class_attendance','class_enrollments','class_sessions','classes',
    'expense_categories','expenses','notifications','payment_methods','payments',
    'plan_programs','plans','programs','pt_exercises_library','pt_payments','pt_plans',
    'pt_programs','pt_sessions','pt_student_contracts','pt_students','pt_training_days',
    'pt_training_executions','pt_training_exercises','student_contracts',
    'student_plan_history','students','studio_settings','user_email_settings'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Super admin can manage all" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "Super admin can manage all" ON public.%I FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()))',
      t
    );
  END LOOP;
END $$;