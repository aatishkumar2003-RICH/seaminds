CREATE OR REPLACE FUNCTION public.enforce_vacancy_freshness()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.first_seen_at := OLD.first_seen_at;
  END IF;
  NEW.expires_at := LEAST(
    COALESCE(NEW.expires_at, 'infinity'::timestamptz),
    (COALESCE(NEW.source_posted_at, COALESCE(NEW.first_seen_at, now())::date) + INTERVAL '183 days')::timestamptz
  );
  IF NEW.dedup_key IS NULL THEN
    NEW.dedup_key := lower(regexp_replace(
      COALESCE(NEW.company_name,'') || '|' || COALESCE(NEW.rank_required,'') || '|' ||
      COALESCE(NEW.vessel_type,'') || '|' || COALESCE(NEW.joining_date::text, NEW.source_posted_at::text, '') || '|' ||
      COALESCE(NEW.apply_url, NEW.source, ''), '\s+', '', 'g'));
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.expire_old_vacancies()
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE n_purged int := 0; n_posts int := 0; n_ads int := 0;
BEGIN
  DELETE FROM external_vacancies WHERE expires_at < now() - interval '183 days';
  GET DIAGNOSTICS n_purged = ROW_COUNT;
  UPDATE job_postings SET status = 'expired' WHERE status = 'active' AND expires_at <= now();
  GET DIAGNOSTICS n_posts = ROW_COUNT;
  UPDATE company_posts SET status = 'expired' WHERE status = 'live' AND created_at < now() - interval '183 days';
  GET DIAGNOSTICS n_ads = ROW_COUNT;
  INSERT INTO app_events (event_type, message, severity)
  VALUES ('vacancy_expiry', format('expiry sweep: purged %s ancient externals, expired %s postings, %s adverts', n_purged, n_posts, n_ads), 'info');
  RETURN format('purged %s, expired %s postings, %s adverts', n_purged, n_posts, n_ads);
EXCEPTION WHEN OTHERS THEN RETURN 'skipped: ' || SQLERRM;
END $function$;

ALTER TABLE public.job_postings ALTER COLUMN expires_at SET DEFAULT (now() + interval '183 days');

-- Backfill: trigger recomputes expires_at as source/first-seen date + 183 days
UPDATE public.external_vacancies SET expires_at = NULL WHERE COALESCE(is_scam_flagged,false) = false;

UPDATE public.job_postings SET expires_at = created_at + interval '183 days', status = 'active'
 WHERE status IN ('active','expired') AND created_at + interval '183 days' > COALESCE(expires_at, '-infinity'::timestamptz);

NOTIFY pgrst, 'reload schema';