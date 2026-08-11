ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS had_cv boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS external_url text;