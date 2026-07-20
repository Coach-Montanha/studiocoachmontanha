ALTER TABLE public.pt_programs
  ADD COLUMN IF NOT EXISTS ai_prompt text,
  ADD COLUMN IF NOT EXISTS ai_generated_at timestamptz;