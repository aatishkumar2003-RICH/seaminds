-- Fix critical RLS findings blocking publish
-- contact_requests_public_access, crew_feedback_public_read,
-- mobile_verifications_anon_exposure, voyage_reports_public_read

-- ============================================
-- contact_requests
-- ============================================
DROP POLICY IF EXISTS "Anyone can insert contact_requests" ON public.contact_requests;
DROP POLICY IF EXISTS "Anyone can read contact_requests" ON public.contact_requests;
DROP POLICY IF EXISTS "Anyone can update contact_requests" ON public.contact_requests;

ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Crew can insert own contact requests"
  ON public.contact_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (public.owns_crew_profile(crew_profile_id));

CREATE POLICY "Involved parties can read contact requests"
  ON public.contact_requests
  FOR SELECT
  TO authenticated
  USING (
    public.owns_crew_profile(crew_profile_id)
    OR auth.uid() = (SELECT user_id FROM public.manager_profiles WHERE id = manager_profile_id)
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "Involved parties can update contact requests"
  ON public.contact_requests
  FOR UPDATE
  TO authenticated
  USING (
    public.owns_crew_profile(crew_profile_id)
    OR auth.uid() = (SELECT user_id FROM public.manager_profiles WHERE id = manager_profile_id)
    OR public.is_admin(auth.uid())
  )
  WITH CHECK (
    public.owns_crew_profile(crew_profile_id)
    OR auth.uid() = (SELECT user_id FROM public.manager_profiles WHERE id = manager_profile_id)
    OR public.is_admin(auth.uid())
  );

-- ============================================
-- crew_feedback
-- ============================================
DROP POLICY IF EXISTS "Anyone can insert feedback" ON public.crew_feedback;
DROP POLICY IF EXISTS "Anyone can read own feedback" ON public.crew_feedback;
DROP POLICY IF EXISTS "admin_read_feedback" ON public.crew_feedback;

ALTER TABLE public.crew_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Crew can insert own feedback"
  ON public.crew_feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (public.owns_crew_profile(profile_id));

CREATE POLICY "Crew can read own feedback"
  ON public.crew_feedback
  FOR SELECT
  TO authenticated
  USING (public.owns_crew_profile(profile_id));

CREATE POLICY "Admin can read all feedback"
  ON public.crew_feedback
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- ============================================
-- mobile_verifications
-- ============================================
DROP POLICY IF EXISTS "Admin dashboard can review verification requests" ON public.mobile_verifications;
DROP POLICY IF EXISTS "Admin dashboard can update verification requests" ON public.mobile_verifications;

ALTER TABLE public.mobile_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Crew can create own verification requests" ON public.mobile_verifications;
DROP POLICY IF EXISTS "Crew can view own verification requests" ON public.mobile_verifications;

CREATE POLICY "Crew can create own verification requests"
  ON public.mobile_verifications
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Crew can view own verification requests"
  ON public.mobile_verifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admin can review verification requests"
  ON public.mobile_verifications
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admin can update verification requests"
  ON public.mobile_verifications
  FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ============================================
-- voyage_reports
-- ============================================
DROP POLICY IF EXISTS "Anyone can insert voyage reports" ON public.voyage_reports;
DROP POLICY IF EXISTS "Anyone can read own voyage reports" ON public.voyage_reports;

ALTER TABLE public.voyage_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Crew can insert own voyage reports"
  ON public.voyage_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (public.owns_crew_profile(crew_profile_id));

CREATE POLICY "Crew can read own voyage reports"
  ON public.voyage_reports
  FOR SELECT
  TO authenticated
  USING (public.owns_crew_profile(crew_profile_id));

CREATE POLICY "Admin can read all voyage reports"
  ON public.voyage_reports
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));