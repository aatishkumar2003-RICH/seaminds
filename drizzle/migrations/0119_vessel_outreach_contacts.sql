CREATE TABLE public.vessel_outreach_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  vessel_name text,
  vessel_type text,
  operator text,
  imo text,
  mailbox_role text,
  source_batch text,
  stage text NOT NULL DEFAULT 'active',
  sends_count integer NOT NULL DEFAULT 0,
  last_sent_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vessel_outreach_contacts TO authenticated;
GRANT ALL ON public.vessel_outreach_contacts TO service_role;
ALTER TABLE public.vessel_outreach_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY vessel_outreach_admin_all ON public.vessel_outreach_contacts
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE INDEX vessel_outreach_stage_idx ON public.vessel_outreach_contacts(stage, last_sent_at);