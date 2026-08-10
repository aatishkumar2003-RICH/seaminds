CREATE POLICY "Admins can view all company accounts" ON public.manager_profiles FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update company approval" ON public.manager_profiles FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
GRANT SELECT, UPDATE ON public.manager_profiles TO authenticated;