ALTER TABLE public.portage_entries ADD COLUMN IF NOT EXISTS sign_off_date date;

CREATE POLICY "Crew views own finalized payslips" ON public.portage_entries FOR SELECT TO authenticated
  USING (status IN ('finalized','paid') AND EXISTS (SELECT 1 FROM public.sea_contracts sc WHERE sc.id = contract_id AND sc.crew_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.crew_desk_certificate_radar()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'application_id', ja.id,
    'crew_name', trim(coalesce(cp.first_name,'')||' '||coalesce(cp.last_name,'')),
    'rank', coalesce(cp.role, ja.rank_applied),
    'vessel', coalesce((SELECT sc.vessel_name FROM sea_contracts sc WHERE sc.application_id = ja.id AND sc.status IN ('issued','signed') ORDER BY sc.created_at DESC LIMIT 1), ja.vessel_type),
    'contract_start', (SELECT sc.start_date FROM sea_contracts sc WHERE sc.application_id = ja.id AND sc.status IN ('issued','signed') ORDER BY sc.created_at DESC LIMIT 1),
    'contract_months', (SELECT sc.duration_months FROM sea_contracts sc WHERE sc.application_id = ja.id AND sc.status IN ('issued','signed') ORDER BY sc.created_at DESC LIMIT 1),
    'certs', CASE WHEN jsonb_typeof(d.certificates)='array' THEN (
       SELECT coalesce(jsonb_agg(jsonb_build_object(
         'name', coalesce(e->>'name', e->>'certificateName', e->>'title', 'Certificate'),
         'number', coalesce(e->>'number', e->>'certificateNumber', e->>'certNumber', ''),
         'expiry', coalesce(e->>'expiryDate', e->>'expiry_date', e->>'expiry', ''))), '[]'::jsonb)
       FROM jsonb_array_elements(d.certificates) e WHERE jsonb_typeof(e)='object') ELSE '[]'::jsonb END
  ) ORDER BY cp.last_name), '[]'::jsonb)
  FROM job_applications ja JOIN crew_profiles cp ON cp.id = ja.crew_id
  LEFT JOIN crew_cv_data d ON d.user_id = cp.id
  WHERE ja.outcome IN ('offered','placed') AND (ja.crew_accepted_at IS NOT NULL OR ja.outcome = 'placed')
    AND public._crew_desk_app_owned(ja.id);
$$;
REVOKE ALL ON FUNCTION public.crew_desk_certificate_radar() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.crew_desk_certificate_radar() TO authenticated;
NOTIFY pgrst, 'reload schema';