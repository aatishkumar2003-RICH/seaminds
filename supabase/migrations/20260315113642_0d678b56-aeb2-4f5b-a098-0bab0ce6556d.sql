
-- Allow authenticated users to insert into admin_settings
CREATE POLICY "Authenticated can insert admin_settings"
ON public.admin_settings
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to update admin_settings
CREATE POLICY "Authenticated can update admin_settings"
ON public.admin_settings
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow authenticated users to insert discount_codes
CREATE POLICY "Authenticated can insert discount_codes"
ON public.discount_codes
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to update discount_codes
CREATE POLICY "Authenticated can update discount_codes"
ON public.discount_codes
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow authenticated users to delete discount_codes
CREATE POLICY "Authenticated can delete discount_codes"
ON public.discount_codes
FOR DELETE
TO authenticated
USING (true);

-- Allow admin to read all crew_profiles
CREATE POLICY "admin_read_all_crew"
ON public.crew_profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.admin_profiles WHERE id = auth.uid())
);

-- Allow admin to update all crew_profiles
CREATE POLICY "admin_update_all_crew"
ON public.crew_profiles
FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.admin_profiles WHERE id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.admin_profiles WHERE id = auth.uid())
);
