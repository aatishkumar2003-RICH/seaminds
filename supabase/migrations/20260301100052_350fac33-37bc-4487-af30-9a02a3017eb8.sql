
-- Add location and personalization columns to crew_profiles
ALTER TABLE public.crew_profiles
  ADD COLUMN IF NOT EXISTS home_country text,
  ADD COLUMN IF NOT EXISTS home_country_code text,
  ADD COLUMN IF NOT EXISTS home_city text,
  ADD COLUMN IF NOT EXISTS last_login_lat double precision,
  ADD COLUMN IF NOT EXISTS last_login_lng double precision,
  ADD COLUMN IF NOT EXISTS last_seen timestamp with time zone DEFAULT now(),
  ADD COLUMN IF NOT EXISTS vessel_imo text,
  ADD COLUMN IF NOT EXISTS location_enabled boolean NOT NULL DEFAULT true;
