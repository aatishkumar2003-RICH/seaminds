CREATE POLICY "authenticated_delete_dpa" ON public.dpa_contacts FOR DELETE TO authenticated USING (true);
CREATE POLICY "authenticated_update_dpa" ON public.dpa_contacts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_insert_dpa" ON public.dpa_contacts FOR INSERT TO authenticated WITH CHECK (true);