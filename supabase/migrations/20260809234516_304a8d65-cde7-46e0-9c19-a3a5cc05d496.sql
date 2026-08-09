-- Add checkin_week_start_day to studio_settings
ALTER TABLE public.studio_settings 
ADD COLUMN IF NOT EXISTS checkin_week_start_day integer DEFAULT 0;

COMMENT ON COLUMN public.studio_settings.checkin_week_start_day IS 'Day of the week when check-in quota resets (0=Sunday, 1=Monday, etc.)';

-- Ensure existing rows have the default
UPDATE public.studio_settings SET checkin_week_start_day = 0 WHERE checkin_week_start_day IS NULL;