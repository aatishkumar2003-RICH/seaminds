CREATE TABLE public.user_legal_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  role text NOT NULL CHECK (role IN ('crew','manager')),
  consent_version text NOT NULL,
  user_agent text,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role, consent_version)
);
GRANT SELECT, INSERT ON public.user_legal_consents TO authenticated;
GRANT ALL ON public.user_legal_consents TO service_role;
ALTER TABLE public.user_legal_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own consents read" ON public.user_legal_consents FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR auth.uid() = '492ee966-e015-4440-a415-6ad6275a4a9b'::uuid);
CREATE POLICY "own consents insert" ON public.user_legal_consents FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());