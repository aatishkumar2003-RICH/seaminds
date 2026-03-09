
-- Helper function: check if current user owns a crew_profile
CREATE OR REPLACE FUNCTION public.owns_crew_profile(_crew_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.crew_profiles
    WHERE id = _crew_profile_id AND user_id = auth.uid()
  );
$$;

-- ===== crew_profiles: tighten to user_id = auth.uid() =====
DROP POLICY IF EXISTS "Allow all access to crew_profiles" ON public.crew_profiles;
DROP POLICY IF EXISTS "Authenticated can read crew_profiles" ON public.crew_profiles;

CREATE POLICY "Users can read own crew_profile"
  ON public.crew_profiles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own crew_profile"
  ON public.crew_profiles FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own crew_profile"
  ON public.crew_profiles FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ===== smc_assessments: scope to own crew_profile =====
DROP POLICY IF EXISTS "Anyone can insert smc_assessments" ON public.smc_assessments;
DROP POLICY IF EXISTS "Anyone can read smc_assessments" ON public.smc_assessments;
DROP POLICY IF EXISTS "Anyone can update smc_assessments" ON public.smc_assessments;

CREATE POLICY "Users can read own smc_assessments"
  ON public.smc_assessments FOR SELECT
  USING (public.owns_crew_profile(crew_profile_id));

CREATE POLICY "Users can insert own smc_assessments"
  ON public.smc_assessments FOR INSERT
  WITH CHECK (public.owns_crew_profile(crew_profile_id));

CREATE POLICY "Users can update own smc_assessments"
  ON public.smc_assessments FOR UPDATE
  USING (public.owns_crew_profile(crew_profile_id))
  WITH CHECK (public.owns_crew_profile(crew_profile_id));

-- ===== wellness_streaks: scope to own crew_profile =====
DROP POLICY IF EXISTS "Anyone can read wellness_streaks" ON public.wellness_streaks;
DROP POLICY IF EXISTS "Anyone can insert wellness_streaks" ON public.wellness_streaks;
DROP POLICY IF EXISTS "Anyone can update wellness_streaks" ON public.wellness_streaks;

CREATE POLICY "Users can read own wellness_streaks"
  ON public.wellness_streaks FOR SELECT
  USING (public.owns_crew_profile(crew_profile_id));

CREATE POLICY "Users can insert own wellness_streaks"
  ON public.wellness_streaks FOR INSERT
  WITH CHECK (public.owns_crew_profile(crew_profile_id));

CREATE POLICY "Users can update own wellness_streaks"
  ON public.wellness_streaks FOR UPDATE
  USING (public.owns_crew_profile(crew_profile_id))
  WITH CHECK (public.owns_crew_profile(crew_profile_id));

-- ===== safety_reports: keep anonymous insert but restrict read/update =====
DROP POLICY IF EXISTS "Anyone can insert safety reports" ON public.safety_reports;
DROP POLICY IF EXISTS "Authenticated can read safety reports" ON public.safety_reports;
DROP POLICY IF EXISTS "Authenticated can update safety reports" ON public.safety_reports;

CREATE POLICY "Authenticated can insert safety reports"
  ON public.safety_reports FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can read safety reports"
  ON public.safety_reports FOR SELECT
  TO authenticated
  USING (true);

-- ===== chat_messages: scope to own crew_profile =====
DROP POLICY IF EXISTS "Allow all access to chat_messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Authenticated can read chat_messages" ON public.chat_messages;

CREATE POLICY "Users can read own chat_messages"
  ON public.chat_messages FOR SELECT
  USING (public.owns_crew_profile(crew_profile_id));

CREATE POLICY "Users can insert own chat_messages"
  ON public.chat_messages FOR INSERT
  WITH CHECK (public.owns_crew_profile(crew_profile_id));
