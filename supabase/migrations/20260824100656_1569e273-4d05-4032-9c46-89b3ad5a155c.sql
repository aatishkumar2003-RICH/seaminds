DROP FUNCTION IF EXISTS public.submit_application(uuid,uuid,text,text,text,text);

CREATE OR REPLACE FUNCTION public.submit_application(p_vacancy_id uuid DEFAULT NULL::uuid, p_company_post_id uuid DEFAULT NULL::uuid, p_company_name text DEFAULT NULL::text, p_rank text DEFAULT NULL::text, p_vessel text DEFAULT NULL::text, p_external_url text DEFAULT NULL::text, p_job_posting_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); existing job_applications%ROWTYPE; readiness jsonb; new_id uuid;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_signed_in'); END IF;
  IF p_vacancy_id IS NULL AND p_company_post_id IS NULL AND p_job_posting_id IS NULL
     AND coalesce(p_external_url,'') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_target'); END IF;

  SELECT * INTO existing FROM job_applications
   WHERE crew_id = uid
     AND ((p_vacancy_id IS NOT NULL AND vacancy_id = p_vacancy_id)
       OR (p_company_post_id IS NOT NULL AND company_post_id = p_company_post_id)
       OR (p_job_posting_id IS NOT NULL AND job_posting_id = p_job_posting_id)
       OR (p_vacancy_id IS NULL AND p_company_post_id IS NULL AND p_job_posting_id IS NULL
           AND external_url = p_external_url AND created_at > now() - interval '14 days'))
   LIMIT 1;
  IF existing.id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'application_id', existing.id); END IF;

  readiness := public.cv_interview_readiness(uid, p_rank);

  INSERT INTO job_applications (crew_id, vacancy_id, company_post_id, job_posting_id, company_name,
    rank_applied, vessel_type, apply_method, had_cv, cv_complete, external_url, outcome)
  VALUES (uid, p_vacancy_id, p_company_post_id, p_job_posting_id, p_company_name, p_rank, p_vessel,
    CASE WHEN p_job_posting_id IS NOT NULL THEN 'seaminds_direct'
         WHEN p_external_url IS NOT NULL THEN 'external' ELSE 'seaminds' END,
    COALESCE((readiness->>'service_entries')::int, 0) > 0,
    COALESCE((readiness->>'ready')::boolean, false), p_external_url, 'awaiting')
  RETURNING id INTO new_id;

  INSERT INTO app_events (event_type, message, severity, metadata)
  VALUES ('job_application', 'Crew applied to a vacancy', 'info',
    jsonb_build_object('application_id', new_id, 'rank', p_rank, 'company', p_company_name,
                       'direct', p_job_posting_id IS NOT NULL));

  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'application_id', new_id,
    'cv_complete', COALESCE((readiness->>'ready')::boolean, false));
END; $function$;

NOTIFY pgrst, 'reload schema';