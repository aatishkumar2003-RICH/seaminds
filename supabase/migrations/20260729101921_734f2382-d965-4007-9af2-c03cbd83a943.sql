ALTER TABLE public.crew_profiles ADD COLUMN IF NOT EXISTS rank text;
UPDATE public.crew_profiles SET rank = role WHERE rank IS NULL;