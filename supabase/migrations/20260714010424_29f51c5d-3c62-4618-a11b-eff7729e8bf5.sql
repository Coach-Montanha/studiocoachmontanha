
CREATE INDEX IF NOT EXISTS idx_payments_user_status_due ON public.payments(user_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_payments_student ON public.payments(student_id);
CREATE INDEX IF NOT EXISTS idx_pt_payments_user_status ON public.pt_payments(user_id, status);
CREATE INDEX IF NOT EXISTS idx_pt_payments_student ON public.pt_payments(pt_student_id);
CREATE INDEX IF NOT EXISTS idx_students_user_status ON public.students(user_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pt_students_user_status ON public.pt_students(user_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pt_sessions_student_date ON public.pt_sessions(pt_student_id, session_date);
CREATE INDEX IF NOT EXISTS idx_pt_sessions_user_date ON public.pt_sessions(user_id, session_date);
CREATE INDEX IF NOT EXISTS idx_pt_training_exercises_day ON public.pt_training_exercises(training_day_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_pt_training_days_program ON public.pt_training_days(program_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON public.expenses(user_id, expense_date);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_read ON public.notifications(recipient_user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_class_attendance_session ON public.class_attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_class_sessions_class_date ON public.class_sessions(class_id, session_date);
