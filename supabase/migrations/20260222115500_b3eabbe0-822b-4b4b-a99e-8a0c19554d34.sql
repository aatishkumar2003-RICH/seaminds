
CREATE TABLE public.safety_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ship_name text NOT NULL,
  manning_agency text,
  category text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'New',
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.safety_reports ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (anonymous reporting - no crew_profile_id stored)
CREATE POLICY "Anyone can insert safety reports"
ON public.safety_reports
FOR INSERT
WITH CHECK (true);

-- Authenticated managers can read reports
CREATE POLICY "Authenticated can read safety reports"
ON public.safety_reports
FOR SELECT
TO authenticated
USING (true);

-- Authenticated managers can update status
CREATE POLICY "Authenticated can update safety reports"
ON public.safety_reports
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
