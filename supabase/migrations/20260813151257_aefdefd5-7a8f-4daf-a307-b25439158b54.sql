ALTER TABLE public.crew_profiles
  ADD COLUMN IF NOT EXISTS total_sea_service_band text,
  ADD COLUMN IF NOT EXISTS years_in_rank_band text,
  ADD COLUMN IF NOT EXISTS contracts_in_rank_band text,
  ADD COLUMN IF NOT EXISTS quick_profile_completed_at timestamptz;

CREATE TABLE IF NOT EXISTS public.crew_vessel_experience (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id uuid NOT NULL,
  vessel_family text NOT NULL,
  sea_time_band text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (crew_id, vessel_family));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crew_vessel_experience TO authenticated;
GRANT ALL ON public.crew_vessel_experience TO service_role;

CREATE INDEX IF NOT EXISTS idx_cve_family ON public.crew_vessel_experience (vessel_family);
ALTER TABLE public.crew_vessel_experience ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crew_own_vessel_exp" ON public.crew_vessel_experience;
CREATE POLICY "crew_own_vessel_exp" ON public.crew_vessel_experience FOR ALL TO authenticated
  USING (crew_id = auth.uid()) WITH CHECK (crew_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.crew_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id uuid NOT NULL,
  claim_key text NOT NULL,
  value text NOT NULL,
  status text NOT NULL DEFAULT 'CLAIMED',
  assessed_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (crew_id, claim_key));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crew_claims TO authenticated;
GRANT ALL ON public.crew_claims TO service_role;

CREATE INDEX IF NOT EXISTS idx_claims_crew ON public.crew_claims (crew_id);
ALTER TABLE public.crew_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crew_own_claims" ON public.crew_claims;
CREATE POLICY "crew_own_claims" ON public.crew_claims FOR ALL TO authenticated
  USING (crew_id = auth.uid()) WITH CHECK (crew_id = auth.uid());