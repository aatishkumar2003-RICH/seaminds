DROP POLICY IF EXISTS "Authenticated can read safety reports" ON public.safety_reports;
DROP POLICY IF EXISTS "Admins can read safety reports" ON public.safety_reports;
CREATE POLICY "Admins can read safety reports"
ON public.safety_reports FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));