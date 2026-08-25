CREATE OR REPLACE FUNCTION public.get_crew_card(p_token text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH me AS (
    SELECT EXISTS (
      SELECT 1 FROM public.manager_profiles mp
      WHERE mp.user_id = auth.uid() AND coalesce(mp.admin_approved,false) = true
    ) AS is_manager
  )
  SELECT coalesce(
    (SELECT CASE WHEN (SELECT is_manager FROM me) THEN
      jsonb_build_object(
        'tier', 'full',
        'first_name', cp.first_name,
        'last_initial', left(coalesce(cp.last_name,''),1),
        'role', coalesce(cp.rank, cp.role),
        'nationality', cp.nationality,
        'years_in_rank_band', cp.years_in_rank_band,
        'contracts_in_rank_band', cp.contracts_in_rank_band,
        'total_sea_service_band', cp.total_sea_service_band,
        'is_available', coalesce(cp.is_available, false),
        'vessel_families', coalesce((
          SELECT jsonb_agg(jsonb_build_object('vessel_family', ve.vessel_family, 'sea_time_band', ve.sea_time_band))
          FROM public.crew_vessel_experience ve WHERE ve.crew_id = cp.id), '[]'::jsonb),
        'score', (
          SELECT jsonb_build_object(
            'overall_score', sa.overall_score,
            'score_band', sa.score_band,
            'certificate_id', sa.certificate_id,
            'completed_at', sa.completed_at)
          FROM public.smc_assessments sa
          WHERE sa.crew_profile_id = cp.id AND sa.status = 'completed'
          ORDER BY sa.completed_at DESC NULLS LAST
          LIMIT 1),
        'claims', coalesce((
          SELECT jsonb_agg(jsonb_build_object('claim_key', cc.claim_key, 'status', cc.status))
          FROM public.crew_claims cc WHERE cc.crew_id = cp.id), '[]'::jsonb)
      )
    ELSE
      jsonb_build_object(
        'tier', 'teaser',
        'first_name', cp.first_name,
        'last_initial', left(coalesce(cp.last_name,''),1),
        'role', coalesce(cp.rank, cp.role),
        'nationality', cp.nationality,
        'is_available', coalesce(cp.is_available, false),
        'score_band', (
          SELECT sa.score_band FROM public.smc_assessments sa
          WHERE sa.crew_profile_id = cp.id AND sa.status = 'completed'
          ORDER BY sa.completed_at DESC NULLS LAST LIMIT 1)
      )
    END
    FROM public.crew_profiles cp
    WHERE cp.public_card_token = p_token
    LIMIT 1),
  '{}'::jsonb);
$function$;

GRANT EXECUTE ON FUNCTION public.get_crew_card(text) TO anon, authenticated;

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
    WHERE jp.manager_id = auth.uid()
       OR (jp.manager_id IS NULL
           AND lower(trim(jp.company_name)) = (SELECT lower(trim(company_name)) FROM manager_profiles WHERE user_id = auth.uid()))
  ) s
$function$;

NOTIFY pgrst, 'reload schema';