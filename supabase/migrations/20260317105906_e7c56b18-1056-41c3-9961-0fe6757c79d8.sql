ALTER TABLE public.smc_assessments
  ADD COLUMN IF NOT EXISTS red_flags jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS report jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS recommendation text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS dimension_scores jsonb DEFAULT NULL;