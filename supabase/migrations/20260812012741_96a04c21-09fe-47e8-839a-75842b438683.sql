ALTER TABLE public.studio_settings ADD COLUMN IF NOT EXISTS logo_pt_base64 text;
ALTER TABLE public.studio_settings ADD COLUMN IF NOT EXISTS logo_studio_base64 text;
GRANT SELECT, UPDATE ON public.studio_settings TO authenticated;