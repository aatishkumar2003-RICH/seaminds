
CREATE TABLE public.family_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_profile_id uuid NOT NULL,
  family_name text NOT NULL,
  family_relation text NOT NULL,
  family_email text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL,
  last_email_sent_at timestamptz,
  UNIQUE (crew_profile_id)
);

ALTER TABLE public.family_connections ENABLE ROW LEVEL SECURITY;

-- Anyone can manage their own family connection (crew use anon key with profile id)
CREATE POLICY "Anyone can insert family connection"
ON public.family_connections
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can read family connections"
ON public.family_connections
FOR SELECT
USING (true);

CREATE POLICY "Anyone can update family connections"
ON public.family_connections
FOR UPDATE
USING (true)
WITH CHECK (true);
