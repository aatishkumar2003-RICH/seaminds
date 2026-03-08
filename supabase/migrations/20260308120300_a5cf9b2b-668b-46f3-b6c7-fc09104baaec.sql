CREATE TABLE public.nps_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  score INTEGER NOT NULL,
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.nps_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert nps_responses" ON public.nps_responses
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Only service role can read nps_responses" ON public.nps_responses
  FOR SELECT USING (false);