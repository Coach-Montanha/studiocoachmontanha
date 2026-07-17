
CREATE TABLE public.ai_image_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt_hash text NOT NULL,
  prompt text NOT NULL,
  model text NOT NULL,
  aspect text NOT NULL,
  image_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, prompt_hash)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_image_cache TO authenticated;
GRANT ALL ON public.ai_image_cache TO service_role;

ALTER TABLE public.ai_image_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own select ai_image_cache" ON public.ai_image_cache
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own insert ai_image_cache" ON public.ai_image_cache
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own delete ai_image_cache" ON public.ai_image_cache
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX ai_image_cache_user_created_idx
  ON public.ai_image_cache (user_id, created_at DESC);
