ALTER TABLE public.pt_training_exercises ADD COLUMN series_type text DEFAULT 'reps_load';
ALTER TABLE public.pt_training_exercises ADD COLUMN time_seconds integer;
ALTER TABLE public.pt_training_exercises ADD COLUMN inclination text;
ALTER TABLE public.pt_training_exercises ADD COLUMN pace text;
ALTER TABLE public.pt_training_exercises ADD COLUMN cadence text;