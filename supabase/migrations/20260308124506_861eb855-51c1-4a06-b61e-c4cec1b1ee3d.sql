CREATE TABLE public.vessel_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vessel_name TEXT NOT NULL,
  company TEXT,
  vessel_type TEXT NOT NULL,
  food INTEGER NOT NULL,
  accommodation INTEGER NOT NULL,
  officers INTEGER NOT NULL,
  work_hours INTEGER NOT NULL,
  internet INTEGER NOT NULL,
  safety INTEGER NOT NULL,
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.vessel_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert vessel_ratings" ON public.vessel_ratings FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read vessel_ratings" ON public.vessel_ratings FOR SELECT USING (true);