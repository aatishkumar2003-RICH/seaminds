CREATE OR REPLACE FUNCTION public.vacancy_origin_counts()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH w AS (
    SELECT contact_whatsapp AS wa FROM public.job_postings WHERE status = 'active'
    UNION ALL
    SELECT contact_whatsapp FROM public.external_vacancies
     WHERE archived_at IS NULL AND COALESCE(is_scam_flagged, false) = false
  ), c AS (
    SELECT wa, regexp_replace(COALESCE(wa,''), '[^0-9+]', '', 'g') AS n FROM w
  ), o AS (
    SELECT CASE
      WHEN n LIKE '+62%' OR n LIKE '62%' OR n LIKE '08%' THEN 'id'
      WHEN n LIKE '+91%' OR n LIKE '91%' THEN 'in'
      WHEN n LIKE '+380%' OR n LIKE '380%' THEN 'ua'
      WHEN n LIKE '+7%' OR (n LIKE '7%' AND length(n) = 11) THEN 'ru'
      WHEN n LIKE '+63%' OR n LIKE '63%' THEN 'ph'
      WHEN n LIKE '+84%' OR n LIKE '84%' THEN 'vn'
      ELSE 'other' END AS k
    FROM c
  )
  SELECT jsonb_build_object('total', (SELECT count(*) FROM o),
    'by', COALESCE((SELECT jsonb_object_agg(k, cnt) FROM (SELECT k, count(*) cnt FROM o GROUP BY k) s), '{}'::jsonb));
$$;
GRANT EXECUTE ON FUNCTION public.vacancy_origin_counts() TO anon, authenticated;