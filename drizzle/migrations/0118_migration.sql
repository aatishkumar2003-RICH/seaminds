CREATE OR REPLACE FUNCTION public.recruiter_outreach_sync()
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE n_new int; n_joined int;
BEGIN
  WITH raw AS (
    SELECT lower(trim(jp.contact_email)) email, jp.recruiter_name rname, jp.created_at, (jp.status='active') active, jp.rank_required rank, jp.id jp_id
      FROM job_postings jp
    UNION ALL
    SELECT lower(trim(ev.contact_email)), ev.company_name, ev.created_at, (ev.archived_at IS NULL), ev.rank_required, NULL::uuid
      FROM external_vacancies ev WHERE coalesce(ev.is_scam_flagged,false) = false
    UNION ALL
    SELECT lower(trim(cc.crewing_email)), cc.company_name, cc.created_at, false, NULL, NULL::uuid FROM company_contacts cc
    UNION ALL
    SELECT lower(trim(cc.hr_email)), cc.company_name, cc.created_at, false, NULL, NULL::uuid FROM company_contacts cc
  ), src AS (
    SELECT email,
      (array_agg(rname ORDER BY created_at DESC) FILTER (WHERE rname IS NOT NULL))[1] rname,
      count(*) FILTER (WHERE active)::int active,
      (SELECT count(*) FROM job_applications ja WHERE ja.job_posting_id = ANY(array_agg(jp_id)) OR ja.vacancy_id = ANY(array_agg(jp_id)))::int apps,
      (array_agg(DISTINCT rank) FILTER (WHERE rank IS NOT NULL))[1:5] ranks
    FROM raw
    WHERE email ~* '^[^@\s]+@[^@\s]+\.[a-z]{2,}$' AND email NOT LIKE '%@seaminds.life'
    GROUP BY email
  ), up AS (
    INSERT INTO recruiter_outreach_contacts (email, recruiter_name, active_vacancies, applications_total, top_ranks)
    SELECT email, rname, active, apps, coalesce(ranks,'{}') FROM src
    ON CONFLICT (email) DO UPDATE SET recruiter_name = coalesce(EXCLUDED.recruiter_name, recruiter_outreach_contacts.recruiter_name),
      active_vacancies = EXCLUDED.active_vacancies, applications_total = EXCLUDED.applications_total,
      top_ranks = EXCLUDED.top_ranks, updated_at = now()
    RETURNING (xmax = 0) AS inserted
  ) SELECT count(*) FILTER (WHERE inserted) INTO n_new FROM up;

  UPDATE recruiter_outreach_contacts c SET stage='joined', updated_at=now()
  WHERE c.stage NOT IN ('joined','unsubscribed','bounced')
    AND EXISTS (SELECT 1 FROM auth.users u JOIN manager_profiles mp ON mp.user_id=u.id WHERE lower(u.email)=c.email);
  GET DIAGNOSTICS n_joined = ROW_COUNT;
  RETURN jsonb_build_object('new', n_new, 'joined', n_joined);
END $function$;
REVOKE ALL ON FUNCTION public.recruiter_outreach_sync() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recruiter_outreach_sync() TO service_role;
NOTIFY pgrst, 'reload schema';