ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS auto_renew boolean NOT NULL DEFAULT false;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS auto_renew boolean;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS renewed_from_payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_payments_renewed_from ON public.payments(renewed_from_payment_id);