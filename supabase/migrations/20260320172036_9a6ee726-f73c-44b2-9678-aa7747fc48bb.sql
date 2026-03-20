
-- Drop existing restrictive policies on sub_admins
DROP POLICY IF EXISTS "Authenticated can delete sub_admins" ON public.sub_admins;
DROP POLICY IF EXISTS "Authenticated can insert sub_admins" ON public.sub_admins;
DROP POLICY IF EXISTS "Authenticated can read sub_admins" ON public.sub_admins;
DROP POLICY IF EXISTS "Authenticated can update sub_admins" ON public.sub_admins;

-- Create public access policies (admin access is PIN-gated at app level)
CREATE POLICY "Anyone can read sub_admins" ON public.sub_admins FOR SELECT USING (true);
CREATE POLICY "Anyone can insert sub_admins" ON public.sub_admins FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update sub_admins" ON public.sub_admins FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete sub_admins" ON public.sub_admins FOR DELETE USING (true);
