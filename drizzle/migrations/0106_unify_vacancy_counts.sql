CREATE OR REPLACE FUNCTION public.market_pulse(p_rank text DEFAULT NULL::text)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
WITH base AS (
  SELECT rank_required, initcap(lower(coalesce(nullif(trim(vessel_type),''),'Other'))) vessel, joining_port, created_at,
    coalesce(nullif(recruiter_name,''), company_name) company,
    nullif(substring(replace(coalesce(monthly_salary,''),',','') from '\d{3,6}'),'')::numeric sal
  FROM job_postings WHERE status='active' AND (expires_at IS NULL OR expires_at > now())
  UNION ALL
  SELECT rank_required, initcap(lower(coalesce(nullif(trim(vessel_type),''),'Other'))), joining_port,
    COALESCE(first_seen_at, fetched_at, created_at), company_name,
    nullif(substring(replace(coalesce(salary_text,''),',','') from '\d{3,6}'),'')::numeric
  FROM external_vacancies WHERE expires_at > now() AND COALESCE(is_scam_flagged,false) = false
), clean AS (
  SELECT *, CASE WHEN sal BETWEEN 400 AND 18000 THEN sal END s FROM base
), mine AS (
  SELECT * FROM clean WHERE p_rank IS NOT NULL AND rank_required ILIKE '%'||split_part(p_rank,' ',1)||'%'
)
SELECT jsonb_build_object(
  'active', (SELECT count(*) FROM clean),
  'companies', (SELECT count(DISTINCT lower(trim(company))) FROM clean WHERE coalesce(trim(company),'') <> ''),
  'new24h', (SELECT count(*) FROM clean WHERE created_at > now()-interval '24 hours'),
  'promoted', (SELECT count(*) FROM vacancy_promotions WHERE ends_at > now()),
  'byVessel', (SELECT coalesce(jsonb_agg(x ORDER BY (x->>'count')::int DESC),'[]'::jsonb) FROM (
      SELECT jsonb_build_object('vessel',vessel,'count',count(*),'avgSalary',coalesce(round(avg(s)/100)*100,0)) x
      FROM clean WHERE vessel NOT IN ('Other','Not Specified','Various') GROUP BY vessel ORDER BY count(*) DESC LIMIT 7) v),
  'topPorts', (SELECT coalesce(jsonb_agg(x),'[]'::jsonb) FROM (
      SELECT jsonb_build_object('port',joining_port,'count',count(*)) x FROM clean
      WHERE coalesce(joining_port,'') <> '' AND joining_port NOT ILIKE 'not specified%' GROUP BY joining_port ORDER BY count(*) DESC LIMIT 4) p),
  'topJobs', (SELECT coalesce(jsonb_agg(x),'[]'::jsonb) FROM (
      SELECT jsonb_build_object('rank',coalesce(rank_required,'Officer'),'vessel',vessel,'salary',s,'company',coalesce(company,'Confidential'),
        'port',CASE WHEN coalesce(joining_port,'') = '' OR joining_port ILIKE 'not specified%' THEN 'Worldwide' ELSE joining_port END) x
      FROM clean WHERE s IS NOT NULL AND created_at > now()-interval '60 days' ORDER BY s DESC, created_at DESC LIMIT 5) j),
  'my', jsonb_build_object('count',(SELECT count(*) FROM mine),
      'avg',(SELECT coalesce(round(avg(s)/100)*100,0) FROM mine),
      'min',(SELECT coalesce(min(s),0) FROM mine),'max',(SELECT coalesce(max(s),0) FROM mine))
)
$function$;

CREATE OR REPLACE FUNCTION public.count_matching_vacancies(p_rank text DEFAULT NULL::text, p_families text[] DEFAULT NULL::text[])
 RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH live AS (
    SELECT rank_required, vessel_type FROM external_vacancies
      WHERE expires_at > now() AND COALESCE(is_scam_flagged,false) = false
    UNION ALL
    SELECT rank_required, vessel_type FROM job_postings
      WHERE status = 'active' AND (expires_at IS NULL OR expires_at > now())
  )
  SELECT count(*)::int FROM live v
  WHERE (p_rank IS NULL OR v.rank_required ILIKE '%' || split_part(p_rank,' ',1) || '%'
         OR v.rank_required ILIKE '%' || p_rank || '%')
    AND (p_families IS NULL OR cardinality(p_families) = 0 OR EXISTS (
      SELECT 1 FROM unnest(p_families) f
      WHERE v.vessel_type ILIKE '%' || replace(replace(f,'_',' '),'/',' ') || '%'
         OR (f ~* 'tanker' AND v.vessel_type ~* 'tanker')
         OR (f ~* 'lng|lpg' AND v.vessel_type ~* 'lng|lpg|gas')
         OR (f ~* 'bulk' AND v.vessel_type ~* 'bulk')
         OR (f ~* 'container' AND v.vessel_type ~* 'container')
         OR (f ~* 'osv|psv|ahts' AND v.vessel_type ~* 'osv|psv|ahts|supply|offshore')))
$function$;

CREATE OR REPLACE FUNCTION public.admin_vacancy_overview()
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN auth.uid() = '492ee966-e015-4440-a415-6ad6275a4a9b'::uuid THEN jsonb_build_object(
    'direct', (SELECT count(*) FROM job_postings WHERE status='active' AND (expires_at IS NULL OR expires_at > now())),
    'external', (SELECT count(*) FROM external_vacancies WHERE expires_at > now() AND COALESCE(is_scam_flagged,false) = false),
    'direct_today', (SELECT count(*) FROM job_postings WHERE status='active' AND created_at > now()-interval '24 hours'),
    'direct_companies', (SELECT count(DISTINCT lower(trim(coalesce(nullif(recruiter_name,''), company_name)))) FROM job_postings WHERE status='active')
  ) END
$function$;
REVOKE ALL ON FUNCTION public.admin_vacancy_overview() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_vacancy_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.market_pulse(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.count_matching_vacancies(text, text[]) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';