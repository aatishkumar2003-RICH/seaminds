CREATE OR REPLACE FUNCTION public._crew_desk_app_owned(_app uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM job_applications ja
    LEFT JOIN job_postings jp ON jp.id = ja.job_posting_id
    LEFT JOIN company_posts cpo ON cpo.id = ja.company_post_id
    WHERE ja.id = _app AND (jp.manager_id = auth.uid() OR cpo.manager_id = auth.uid()
      OR (jp.manager_id IS NULL AND jp.id IS NOT NULL AND lower(trim(jp.company_name)) =
          (SELECT lower(trim(company_name)) FROM manager_profiles WHERE user_id = auth.uid())))
  ) AND EXISTS (SELECT 1 FROM manager_profiles WHERE user_id = auth.uid() AND admin_approved);
$$;

CREATE OR REPLACE FUNCTION public.crew_desk_roster()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'application_id', ja.id, 'outcome', ja.outcome,
    'crew_name', trim(coalesce(cp.first_name,'')||' '||coalesce(cp.last_name,'')),
    'rank', coalesce(cp.role, ja.rank_applied), 'nationality', cp.nationality,
    'vessel', ja.vessel_type, 'joining_date', ja.offered_joining_date,
    'placement_end', ja.placement_end,
    'crew_confirmed', ja.crew_accepted_at IS NOT NULL OR ja.outcome = 'placed',
    'crew_unique_id', cp.crew_unique_id
  ) ORDER BY ja.created_at DESC), '[]'::jsonb)
  FROM job_applications ja JOIN crew_profiles cp ON cp.id = ja.crew_id
  WHERE ja.outcome IN ('shortlisted','offered','placed') AND public._crew_desk_app_owned(ja.id);
$$;

CREATE OR REPLACE FUNCTION public.crew_desk_master_record(_application_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ja job_applications; r jsonb; co text;
BEGIN
  IF NOT public._crew_desk_app_owned(_application_id) THEN RETURN jsonb_build_object('error','not_allowed'); END IF;
  SELECT * INTO ja FROM job_applications WHERE id = _application_id;
  IF ja.crew_accepted_at IS NULL AND ja.outcome <> 'placed' THEN
    RETURN jsonb_build_object('error','crew_not_confirmed'); END IF;
  SELECT jsonb_build_object(
    'personal', coalesce(d.medical->'personal','{}'::jsonb),
    'skills', coalesce(d.medical->'skills','{}'::jsonb),
    'training', CASE WHEN jsonb_typeof(d.medical->'training')='array' THEN d.medical->'training' ELSE '[]'::jsonb END,
    'photo', d.medical->'photo', 'cv_uid', coalesce(d.medical->>'cv_uid', cp.crew_unique_id),
    'declaration', d.medical->'declaration',
    'sea', CASE WHEN jsonb_typeof(d.sea_service)='array' THEN d.sea_service ELSE '[]'::jsonb END,
    'certs', CASE WHEN jsonb_typeof(d.certificates)='array' THEN d.certificates ELSE '[]'::jsonb END,
    'edu', CASE WHEN jsonb_typeof(d.education)='array' THEN d.education ELSE '[]'::jsonb END,
    'profile', jsonb_build_object('first_name',cp.first_name,'last_name',cp.last_name,'rank',cp.role,
       'nationality',cp.nationality,'crew_unique_id',cp.crew_unique_id)
  ) INTO r
  FROM crew_profiles cp LEFT JOIN crew_cv_data d ON d.user_id = cp.id
  WHERE cp.id = ja.crew_id;
  SELECT company_name INTO co FROM manager_profiles WHERE user_id = auth.uid();
  INSERT INTO cv_access_log(manager_user_id, company_name, crew_user_id, action)
  VALUES (auth.uid(), co, ja.crew_id, 'crew_desk_export');
  RETURN r;
END $$;

REVOKE ALL ON FUNCTION public._crew_desk_app_owned(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.crew_desk_roster() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.crew_desk_master_record(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crew_desk_roster() TO authenticated;
GRANT EXECUTE ON FUNCTION public.crew_desk_master_record(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public._crew_desk_app_owned(uuid) TO authenticated;