ALTER TABLE public.pt_training_exercises ADD COLUMN substitute_exercise_id uuid REFERENCES public.pt_training_exercises(id) ON DELETE SET NULL;
GRANT ALL ON public.pt_training_exercises TO authenticated;
GRANT ALL ON public.pt_training_exercises TO service_role;