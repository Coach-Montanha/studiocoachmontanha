
DO $$
DECLARE
  src uuid := '89a09a39-f560-43a0-9477-44719a5efda4';
  dst uuid := 'f4ddca03-67ad-43ec-bf0b-33ba28c5e295';
BEGIN
  -- Remove admin role duplicado na origem (destino já possui admin; super_admin fica na origem)
  DELETE FROM public.user_roles WHERE user_id = src AND role = 'admin';

  -- Reassinala tenant ownership de todas as tabelas com user_id
  UPDATE public.announcements            SET user_id = dst WHERE user_id = src;
  UPDATE public.class_attendance         SET user_id = dst WHERE user_id = src;
  UPDATE public.class_enrollments        SET user_id = dst WHERE user_id = src;
  UPDATE public.class_sessions           SET user_id = dst WHERE user_id = src;
  UPDATE public.classes                  SET user_id = dst WHERE user_id = src;
  UPDATE public.expense_categories       SET user_id = dst WHERE user_id = src;
  UPDATE public.expenses                 SET user_id = dst WHERE user_id = src;
  UPDATE public.payment_methods          SET user_id = dst WHERE user_id = src;
  UPDATE public.payments                 SET user_id = dst WHERE user_id = src;
  UPDATE public.plan_programs            SET user_id = dst WHERE user_id = src;
  UPDATE public.plans                    SET user_id = dst WHERE user_id = src;
  UPDATE public.programs                 SET user_id = dst WHERE user_id = src;
  UPDATE public.pt_exercises_library     SET user_id = dst WHERE user_id = src;
  UPDATE public.pt_payments              SET user_id = dst WHERE user_id = src;
  UPDATE public.pt_plans                 SET user_id = dst WHERE user_id = src;
  UPDATE public.pt_programs              SET user_id = dst WHERE user_id = src;
  UPDATE public.pt_sessions              SET user_id = dst WHERE user_id = src;
  UPDATE public.pt_student_contracts     SET user_id = dst WHERE user_id = src;
  UPDATE public.pt_students              SET user_id = dst WHERE user_id = src;
  UPDATE public.pt_training_days         SET user_id = dst WHERE user_id = src;
  UPDATE public.pt_training_executions   SET user_id = dst WHERE user_id = src;
  UPDATE public.pt_training_exercises    SET user_id = dst WHERE user_id = src;
  UPDATE public.student_contracts        SET user_id = dst WHERE user_id = src;
  UPDATE public.student_plan_history     SET user_id = dst WHERE user_id = src;
  UPDATE public.students                 SET user_id = dst WHERE user_id = src;
  UPDATE public.studio_settings          SET user_id = dst WHERE user_id = src;
  UPDATE public.user_email_settings      SET user_id = dst WHERE user_id = src;
  -- user_modules: origem não tem linhas, nada a fazer
  -- user_roles: super_admin permanece na origem por decisão do usuário

  -- Recalcula status dos alunos migrados
  PERFORM public.recalculate_all_student_statuses_for(dst);
  PERFORM public.recalculate_all_pt_student_statuses_for(dst);
END $$;
