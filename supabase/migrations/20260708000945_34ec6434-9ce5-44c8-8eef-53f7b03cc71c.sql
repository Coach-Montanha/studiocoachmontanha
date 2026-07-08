
CREATE TABLE public.plan_programs (
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (plan_id, program_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_programs TO authenticated;
GRANT ALL ON public.plan_programs TO service_role;

ALTER TABLE public.plan_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own plan_programs"
  ON public.plan_programs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_plan_programs_plan_id ON public.plan_programs(plan_id);
CREATE INDEX idx_plan_programs_program_id ON public.plan_programs(program_id);
