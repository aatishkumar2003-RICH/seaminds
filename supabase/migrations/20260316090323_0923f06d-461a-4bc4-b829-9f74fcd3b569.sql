
-- Allow authenticated users to manage country_pricing (insert, update, delete)
CREATE POLICY "Authenticated can insert country_pricing" ON public.country_pricing FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update country_pricing" ON public.country_pricing FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Allow authenticated users to manage sub_admins
DROP POLICY IF EXISTS "admin_only_sub_admins" ON public.sub_admins;
CREATE POLICY "Authenticated can read sub_admins" ON public.sub_admins FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert sub_admins" ON public.sub_admins FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update sub_admins" ON public.sub_admins FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete sub_admins" ON public.sub_admins FOR DELETE TO authenticated USING (true);
