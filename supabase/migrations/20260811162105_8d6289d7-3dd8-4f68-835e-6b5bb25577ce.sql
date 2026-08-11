ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS offered_at timestamptz,
  ADD COLUMN IF NOT EXISTS offered_joining_date date,
  ADD COLUMN IF NOT EXISTS crew_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS placement_end date,
  ADD COLUMN IF NOT EXISTS released_at timestamptz;

ALTER TABLE public.crew_profiles
  ADD COLUMN IF NOT EXISTS placed_company text,
  ADD COLUMN IF NOT EXISTS placed_until date;