ALTER TABLE public.smc_assessments ADD COLUMN IF NOT EXISTS level_profile jsonb;
NOTIFY pgrst,'reload schema';