-- =========================================
-- 1. PROGRAMS
-- =========================================
CREATE TABLE public.programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX programs_user_id_idx ON public.programs(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.programs TO authenticated;
GRANT ALL ON public.programs TO service_role;

ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin manages programs"
  ON public.programs FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "student reads own educator programs"
  ON public.programs FOR SELECT TO authenticated
  USING (
    is_active
    AND public.has_role(auth.uid(), 'student')
    AND EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.account_user_id = auth.uid() AND s.user_id = programs.user_id
    )
  );

CREATE TRIGGER trg_programs_updated
  BEFORE UPDATE ON public.programs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- 2. STUDIO_SETTINGS
-- =========================================
CREATE TABLE public.studio_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  allow_multi_checkin_same_program_per_day BOOLEAN NOT NULL DEFAULT false,
  default_checkin_opens_minutes_before INT NOT NULL DEFAULT 60,
  default_checkin_closes_minutes_before INT NOT NULL DEFAULT 15,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_settings TO authenticated;
GRANT ALL ON public.studio_settings TO service_role;

ALTER TABLE public.studio_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin manages own studio settings"
  ON public.studio_settings FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "student reads own educator studio settings"
  ON public.studio_settings FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'student')
    AND EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.account_user_id = auth.uid() AND s.user_id = studio_settings.user_id
    )
  );

CREATE TRIGGER trg_studio_settings_updated
  BEFORE UPDATE ON public.studio_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- 3. CLASSES — multi-day + checkin window + program
-- =========================================
ALTER TABLE public.classes
  ADD COLUMN days_of_week SMALLINT[] NOT NULL DEFAULT '{}',
  ADD COLUMN checkin_opens_minutes_before INT NOT NULL DEFAULT 60,
  ADD COLUMN checkin_closes_minutes_before INT NOT NULL DEFAULT 15,
  ADD COLUMN program_id UUID REFERENCES public.programs(id) ON DELETE SET NULL;

-- Backfill days_of_week from day_of_week
UPDATE public.classes
   SET days_of_week = ARRAY[day_of_week]::SMALLINT[]
 WHERE day_of_week IS NOT NULL AND array_length(days_of_week, 1) IS NULL;

CREATE INDEX classes_program_id_idx ON public.classes(program_id);

-- =========================================
-- 4. PLANS — check-in quota
-- =========================================
ALTER TABLE public.plans
  ADD COLUMN checkin_quota_type TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN checkin_quota_amount INT,
  ADD COLUMN package_valid_days INT;

ALTER TABLE public.plans
  ADD CONSTRAINT plans_checkin_quota_type_check
  CHECK (checkin_quota_type IN ('none','weekly','monthly','package'));