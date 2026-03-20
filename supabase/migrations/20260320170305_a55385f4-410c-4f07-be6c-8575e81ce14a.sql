
CREATE TABLE public.company_demo_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  fleet_size TEXT,
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.company_demo_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert demo requests"
  ON public.company_demo_requests
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Only service role can read demo requests"
  ON public.company_demo_requests
  FOR SELECT
  TO public
  USING (false);
