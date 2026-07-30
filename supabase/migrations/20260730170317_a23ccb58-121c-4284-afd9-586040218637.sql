CREATE TABLE IF NOT EXISTS public.mobile_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  full_name text,
  email text,
  phone_number text NOT NULL,
  verification_token text NOT NULL UNIQUE,
  email_verified boolean NOT NULL DEFAULT false,
  verification_status text NOT NULL DEFAULT 'pending',
  provider text NOT NULL DEFAULT 'whatsapp_manual',
  verified_at timestamptz,
  verified_by text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.mobile_verifications TO authenticated;
GRANT SELECT, UPDATE ON public.mobile_verifications TO anon;
GRANT ALL ON public.mobile_verifications TO service_role;

ALTER TABLE public.mobile_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Crew can create own verification requests"
  ON public.mobile_verifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Crew can view own verification requests"
  ON public.mobile_verifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admin dashboard can review verification requests"
  ON public.mobile_verifications FOR SELECT TO anon
  USING (true);

CREATE POLICY "Admin dashboard can update verification requests"
  ON public.mobile_verifications FOR UPDATE TO anon
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS mobile_verifications_status_idx ON public.mobile_verifications (verification_status, created_at DESC);
CREATE INDEX IF NOT EXISTS mobile_verifications_phone_idx ON public.mobile_verifications (phone_number);

CREATE TRIGGER mobile_verifications_updated_at
  BEFORE UPDATE ON public.mobile_verifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.crew_profiles ADD COLUMN IF NOT EXISTS whatsapp_verification_token text;
ALTER TABLE public.crew_profiles ADD COLUMN IF NOT EXISTS phone_valid boolean NOT NULL DEFAULT false;