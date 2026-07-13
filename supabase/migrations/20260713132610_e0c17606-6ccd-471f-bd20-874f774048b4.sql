ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS max_renewals integer;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS renewals_remaining integer;