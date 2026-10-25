CREATE TABLE public.whatsapp_crew_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  phone_e164 text NOT NULL UNIQUE,
  phone_raw text,
  rank_detected text,
  audience text NOT NULL DEFAULT 'crew',
  source text NOT NULL DEFAULT 'paste',
  batch_tag text,
  status text NOT NULL DEFAULT 'staged',
  message_sid text,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_crew_leads TO authenticated;
GRANT ALL ON public.whatsapp_crew_leads TO service_role;
ALTER TABLE public.whatsapp_crew_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner admin only" ON public.whatsapp_crew_leads FOR ALL TO authenticated
  USING (auth.uid() = '492ee966-e015-4440-a415-6ad6275a4a9b'::uuid)
  WITH CHECK (auth.uid() = '492ee966-e015-4440-a415-6ad6275a4a9b'::uuid);