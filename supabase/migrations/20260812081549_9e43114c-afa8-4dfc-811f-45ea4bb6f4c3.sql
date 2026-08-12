ALTER TABLE public.crew_profiles
  ADD COLUMN IF NOT EXISTS referred_by uuid,
  ADD COLUMN IF NOT EXISTS referral_claimed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_crew_referred_by ON public.crew_profiles (referred_by);