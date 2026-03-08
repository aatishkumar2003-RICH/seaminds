
CREATE TABLE public.wellness_streaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_profile_id uuid NOT NULL UNIQUE,
  current_streak integer NOT NULL DEFAULT 1,
  longest_streak integer NOT NULL DEFAULT 1,
  last_checkin_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.wellness_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read wellness_streaks"
  ON public.wellness_streaks FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert wellness_streaks"
  ON public.wellness_streaks FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update wellness_streaks"
  ON public.wellness_streaks FOR UPDATE
  USING (true)
  WITH CHECK (true);
