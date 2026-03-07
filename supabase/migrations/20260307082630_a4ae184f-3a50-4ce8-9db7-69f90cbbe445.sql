CREATE TABLE IF NOT EXISTS public.crew_feedback (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid REFERENCES public.crew_profiles(id) ON DELETE SET NULL,
  raw_text text NOT NULL,
  ai_summary text,
  rank text,
  nationality text,
  ship_name text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.crew_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert feedback" ON public.crew_feedback FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read own feedback" ON public.crew_feedback FOR SELECT USING (true);