
-- 1) Add max_freeze_days to Studio plans
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS max_freeze_days INTEGER;

-- 2) Create payment_freezes table (trancamentos)
CREATE TABLE IF NOT EXISTS public.payment_freezes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  freeze_days INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_freezes TO authenticated;
GRANT ALL ON public.payment_freezes TO service_role;

ALTER TABLE public.payment_freezes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own freezes"
  ON public.payment_freezes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Super admin manage all freezes"
  ON public.payment_freezes FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER update_payment_freezes_updated_at
  BEFORE UPDATE ON public.payment_freezes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_payment_freezes_student ON public.payment_freezes(student_id);
CREATE INDEX IF NOT EXISTS idx_payment_freezes_payment ON public.payment_freezes(payment_id);
