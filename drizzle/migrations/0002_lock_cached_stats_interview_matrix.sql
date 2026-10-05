DROP POLICY IF EXISTS anyone_reads_cached_stats ON public.cached_stats;
CREATE POLICY admin_reads_cached_stats ON public.cached_stats FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS authenticated_read_matrix ON public.interview_matrix;