CREATE OR REPLACE FUNCTION public.vacancy_origin_counts_compute()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH o AS (
    SELECT public.vacancy_origin_of(contact_whatsapp, contact_email, recruiter_name) AS k
      FROM public.job_postings WHERE status = 'active'
    UNION ALL
    SELECT public.vacancy_origin_of(contact_whatsapp, contact_email, company_name)
      FROM public.external_vacancies
     WHERE archived_at IS NULL AND COALESCE(is_scam_flagged, false) = false
  )
  SELECT jsonb_build_object('total', (SELECT count(*) FROM o),
    'by', COALESCE((SELECT jsonb_object_agg(k, cnt) FROM (SELECT k, count(*) cnt FROM o GROUP BY k) s), '{}'::jsonb));
$$;
REVOKE ALL ON FUNCTION public.vacancy_origin_counts_compute() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.refresh_vacancy_origin_counts()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' SET statement_timeout TO '60s' AS $$
BEGIN
  INSERT INTO public.cached_stats(key, value, updated_at)
  VALUES ('vacancy_origin_counts', public.vacancy_origin_counts_compute(), now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
END $$;
REVOKE ALL ON FUNCTION public.refresh_vacancy_origin_counts() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.vacancy_origin_counts()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE((SELECT value FROM public.cached_stats WHERE key = 'vacancy_origin_counts'),
                  jsonb_build_object('total', 0, 'by', '{}'::jsonb));
$$;

SELECT public.refresh_vacancy_origin_counts();

DO $$ BEGIN
  PERFORM cron.unschedule('refresh-vacancy-origin-counts') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='refresh-vacancy-origin-counts');
  PERFORM cron.schedule('refresh-vacancy-origin-counts', '7 * * * *', 'SELECT public.refresh_vacancy_origin_counts()');
END $$;