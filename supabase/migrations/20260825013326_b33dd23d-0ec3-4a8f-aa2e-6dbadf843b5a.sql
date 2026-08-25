UPDATE public.job_postings jp
SET manager_id = mp.user_id
FROM public.manager_profiles mp
WHERE jp.manager_id IS NULL
  AND coalesce(mp.admin_approved,false) = true
  AND lower(trim(jp.company_name)) = lower(trim(mp.company_name));

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
      'offered_joining_date', ja.offered_joining_date
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
      'offered_joining_date', ja.offered_joining_date
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