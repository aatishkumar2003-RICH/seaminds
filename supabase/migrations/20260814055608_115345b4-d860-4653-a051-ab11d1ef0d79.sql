ALTER TABLE public.manager_profiles
  ADD COLUMN IF NOT EXISTS dpa_name text,
  ADD COLUMN IF NOT EXISTS emergency_phone text,
  ADD COLUMN IF NOT EXISTS emergency_email text,
  ADD COLUMN IF NOT EXISTS emergency_updated_at timestamptz;