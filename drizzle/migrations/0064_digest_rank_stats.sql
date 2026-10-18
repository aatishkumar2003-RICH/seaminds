CREATE OR REPLACE FUNCTION public.digest_rank_stats()
RETURNS TABLE(rank_raw text, vessel_bucket text, origin text, fresh boolean, n bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT lower(trim(rank_required)),
    CASE WHEN vessel_type ~* 'tank|lpg|lng|chem|gas|oil' THEN 'Tanker'
         WHEN vessel_type ~* 'bulk' THEN 'Bulk'
         WHEN vessel_type ~* 'contain' THEN 'Container'
         WHEN vessel_type ~* 'offshore|ahts|psv|dp|supply|rig' THEN 'Offshore'
         ELSE 'Other' END,
    public.vacancy_origin_of(contact_whatsapp, contact_email, recruiter_name),
    created_at > now() - interval '24 hours',
    count(*)
  FROM public.job_postings
  WHERE status = 'active' AND rank_required IS NOT NULL
  GROUP BY 1,2,3,4;
$$;
REVOKE ALL ON FUNCTION public.digest_rank_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.digest_rank_stats() TO service_role;