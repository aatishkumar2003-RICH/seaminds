CREATE TABLE IF NOT EXISTS public.post_interests (
  id uuid primary key default gen_random_uuid(),
  company_post_id uuid not null references public.company_posts(id) on delete cascade,
  crew_id uuid not null,
  created_at timestamptz not null default now(),
  unique(company_post_id, crew_id)
);

GRANT SELECT, INSERT ON public.post_interests TO authenticated;
GRANT ALL ON public.post_interests TO service_role;

ALTER TABLE public.post_interests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crew insert own interest" ON public.post_interests FOR INSERT TO authenticated WITH CHECK (crew_id = auth.uid());
CREATE POLICY "crew read own interest" ON public.post_interests FOR SELECT TO authenticated USING (crew_id = auth.uid());

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

NOTIFY pgrst,'reload schema';