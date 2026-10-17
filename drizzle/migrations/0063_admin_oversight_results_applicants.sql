CREATE OR REPLACE FUNCTION public.campaign_leaderboard(p_campaign_id uuid)
 RETURNS TABLE(invite_id uuid, token text, name text, whatsapp text, nationality text, status text, overall numeric, technical numeric, judgment numeric, english numeric, behavioural numeric, band text, red_flag_count integer, shortlisted boolean, completed_at timestamp with time zone, scoring_tier text, cv_request_status text, round integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM interview_campaigns c WHERE c.id = p_campaign_id AND (c.manager_id = auth.uid() OR auth.uid() = '492ee966-e015-4440-a415-6ad6275a4a9b'::uuid)) THEN
    RETURN;
  END IF;
  -- Four professional dimensions only; wellness is never returned to managers.
  RETURN QUERY
  SELECT i.id, i.token,
         COALESCE(i.invited_name, cp.first_name, 'Candidate'),
         COALESCE(i.invited_whatsapp, cp.whatsapp_number),
         cp.nationality, i.status,
         a.overall_score, a.technical_score, a.judgment_score, a.english_score, a.behavioural_score, a.score_band,
         COALESCE((
           SELECT count(*)::int FROM jsonb_array_elements(a.red_flags) f
           WHERE jsonb_typeof(a.red_flags) = 'array'
             AND upper(COALESCE(f->>'category','')) NOT IN ('WELLNESS_CONCERN','WELLNESS','MENTAL_HEALTH','FATIGUE','STRESS','FAMILY','MOOD','WELLBEING')
         ), 0),
         i.shortlisted, i.completed_at, a.scoring_tier, i.cv_request_status,
         CASE WHEN a.id IS NOT NULL AND a.id = r2.id THEN 2 ELSE 1 END
  FROM interview_invites i
  LEFT JOIN crew_profiles cp ON cp.id = i.crew_profile_id
  LEFT JOIN smc_assessments r2 ON r2.id = i.round_2_assessment_id AND r2.status = 'completed' AND r2.overall_score IS NOT NULL
  LEFT JOIN smc_assessments a ON a.id = COALESCE(r2.id, i.assessment_id)
  WHERE i.campaign_id = p_campaign_id
  ORDER BY a.overall_score DESC NULLS LAST, i.created_at ASC;
END; $function$;

CREATE OR REPLACE FUNCTION public.get_my_applicants()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT coalesce(jsonb_agg(x ORDER BY (x->>'applied_at') DESC), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
      'application_id', ja.id,
      'applied_at', ja.created_at,
      'outcome', ja.outcome,
      'rank', ja.rank_applied,
      'vessel', ja.vessel_type,
      'crew_name', trim(coalesce(cp.first_name,'') || ' ' || coalesce(cp.last_name,'')),
      'nationality', cp.nationality,
      'crew_rank', cp.role,
      'available_from', ja.available_from,
      'offered_joining_date', ja.offered_joining_date,
      'job_posting_id', NULL,
      'vacancy_label', cpo.company_name
    ) AS x
    FROM job_applications ja
    JOIN company_posts cpo ON cpo.id = ja.company_post_id
    JOIN crew_profiles cp ON cp.id = ja.crew_id
    WHERE cpo.manager_id = auth.uid()

    UNION ALL

    SELECT jsonb_build_object(
      'application_id', ja.id,
      'applied_at', ja.created_at,
      'outcome', ja.outcome,
      'rank', ja.rank_applied,
      'vessel', ja.vessel_type,
      'crew_name', trim(coalesce(cp.first_name,'') || ' ' || coalesce(cp.last_name,'')),
      'nationality', cp.nationality,
      'crew_rank', cp.role,
      'available_from', ja.available_from,
      'offered_joining_date', ja.offered_joining_date,
      'job_posting_id', jp.id,
      'vacancy_label', concat_ws(' — ', jp.rank_required, jp.vessel_type)
    ) AS x
    FROM job_applications ja
    JOIN job_postings jp ON jp.id = ja.job_posting_id
    JOIN crew_profiles cp ON cp.id = ja.crew_id
    WHERE auth.uid() = '492ee966-e015-4440-a415-6ad6275a4a9b'::uuid OR jp.manager_id = auth.uid()
       OR (jp.manager_id IS NULL
           AND lower(trim(jp.company_name)) = (SELECT lower(trim(company_name)) FROM manager_profiles WHERE user_id = auth.uid()))

    UNION ALL

    SELECT jsonb_build_object(
      'application_id', pi.id,
      'applied_at', pi.created_at,
      'outcome', 'interested',
      'rank', c.role,
      'vessel', cp2.post_type,
      'crew_name', trim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')),
      'nationality', c.nationality,
      'crew_rank', c.role,
      'available_from', NULL,
      'offered_joining_date', NULL,
      'job_posting_id', NULL,
      'vacancy_label', left(cp2.caption, 60)
    ) AS x
    FROM post_interests pi
    JOIN company_posts cp2 ON cp2.id = pi.company_post_id
    JOIN crew_profiles c ON c.id = pi.crew_id
    WHERE cp2.manager_id = auth.uid()
  ) s
$function$;

NOTIFY pgrst, 'reload schema';