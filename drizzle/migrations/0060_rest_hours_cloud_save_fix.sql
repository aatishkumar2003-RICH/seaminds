CREATE UNIQUE INDEX IF NOT EXISTS rest_hours_data_crew_profile_id_key ON public.rest_hours_data (crew_profile_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rest_hours_data TO authenticated;
GRANT ALL ON public.rest_hours_data TO service_role;
DROP POLICY IF EXISTS own_rest_hours ON public.rest_hours_data;
CREATE POLICY own_rest_hours ON public.rest_hours_data FOR ALL TO authenticated
  USING (crew_profile_id = auth.uid()) WITH CHECK (crew_profile_id = auth.uid());