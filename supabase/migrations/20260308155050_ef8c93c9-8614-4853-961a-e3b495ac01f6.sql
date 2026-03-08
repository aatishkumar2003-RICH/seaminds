ALTER TABLE public.crew_profiles
  ADD COLUMN IF NOT EXISTS vessel_type text DEFAULT null,
  ADD COLUMN IF NOT EXISTS port_of_joining text DEFAULT null,
  ADD COLUMN IF NOT EXISTS onboarding_complete boolean NOT NULL DEFAULT false;