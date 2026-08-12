DROP POLICY IF EXISTS "Crew manages own applications" ON public.job_applications;
CREATE POLICY "Crew reads own applications" ON public.job_applications
  FOR SELECT TO authenticated USING (crew_id = auth.uid());
CREATE POLICY "Crew creates own applications" ON public.job_applications
  FOR INSERT TO authenticated WITH CHECK (crew_id = auth.uid());

DROP POLICY IF EXISTS "Crew sees own invite" ON public.interview_invites;
CREATE POLICY "Crew reads own invite" ON public.interview_invites
  FOR SELECT TO authenticated USING (crew_profile_id = auth.uid());