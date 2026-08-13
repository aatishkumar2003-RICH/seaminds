ALTER TABLE public.smc_assessments ADD COLUMN IF NOT EXISTS scoring_version text DEFAULT 'v1.1';
ALTER TABLE public.smc_assessments ALTER COLUMN scoring_version SET DEFAULT 'v1.1';