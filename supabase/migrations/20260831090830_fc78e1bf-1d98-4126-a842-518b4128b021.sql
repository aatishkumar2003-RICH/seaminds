ALTER TABLE public.crew_profiles ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

UPDATE public.crew_profiles
SET is_test = true
WHERE crew_unique_id ILIKE 'SM-QA%'
   OR first_name ILIKE 'qa %'
   OR first_name ILIKE 'test%';

NOTIFY pgrst, 'reload schema';