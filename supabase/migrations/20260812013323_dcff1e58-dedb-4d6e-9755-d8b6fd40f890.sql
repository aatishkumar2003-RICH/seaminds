ALTER TABLE public.crew_documents
  ADD COLUMN IF NOT EXISTS doc_type text,
  ADD COLUMN IF NOT EXISTS doc_number text,
  ADD COLUMN IF NOT EXISTS issuing_authority text,
  ADD COLUMN IF NOT EXISTS issue_date date,
  ADD COLUMN IF NOT EXISTS expiry_date date,
  ADD COLUMN IF NOT EXISTS ai_confidence numeric,
  ADD COLUMN IF NOT EXISTS extraction_status text NOT NULL DEFAULT 'pending';

CREATE TABLE IF NOT EXISTS public.document_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rank text NOT NULL, vessel_type text, doc_type text NOT NULL,
  is_mandatory boolean NOT NULL DEFAULT true, notes text,
  created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.document_requirements TO anon, authenticated;
GRANT ALL ON public.document_requirements TO service_role;
ALTER TABLE public.document_requirements ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.marketing_team (
  user_id uuid PRIMARY KEY, email text NOT NULL,
  active boolean NOT NULL DEFAULT true, added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.marketing_team TO authenticated;
GRANT ALL ON public.marketing_team TO service_role;
ALTER TABLE public.marketing_team ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.marketing_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL, label text, url text NOT NULL,
  added_by uuid, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_channels TO authenticated;
GRANT ALL ON public.marketing_channels TO service_role;
ALTER TABLE public.marketing_channels ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.marketing_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, email text, action text NOT NULL,
  details jsonb, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.marketing_activity_log TO authenticated;
GRANT ALL ON public.marketing_activity_log TO service_role;
ALTER TABLE public.marketing_activity_log ENABLE ROW LEVEL SECURITY;