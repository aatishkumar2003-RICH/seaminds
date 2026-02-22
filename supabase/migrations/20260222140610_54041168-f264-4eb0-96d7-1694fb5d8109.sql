
CREATE TABLE public.voyage_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  crew_profile_id UUID NOT NULL,
  ship_name TEXT NOT NULL,
  role TEXT NOT NULL,
  voyage_start_date DATE NOT NULL,
  voyage_end_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_days INTEGER NOT NULL DEFAULT 0,
  total_checkins INTEGER NOT NULL DEFAULT 0,
  mood_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  ai_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.voyage_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert voyage reports" ON public.voyage_reports
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can read own voyage reports" ON public.voyage_reports
  FOR SELECT USING (true);
