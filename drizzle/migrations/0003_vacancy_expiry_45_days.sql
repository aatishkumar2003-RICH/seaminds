CREATE OR REPLACE FUNCTION public.enforce_vacancy_freshness()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.first_seen_at := OLD.first_seen_at;
  END IF;
  NEW.expires_at := LEAST(
    COALESCE(NEW.expires_at, 'infinity'::timestamptz),
    (COALESCE(NEW.source_posted_at, COALESCE(NEW.first_seen_at, now())::date) + INTERVAL '45 days')::timestamptz
  );
  IF NEW.dedup_key IS NULL THEN
    NEW.dedup_key := lower(regexp_replace(
      COALESCE(NEW.company_name,'') || '|' || COALESCE(NEW.rank_required,'') || '|' ||
      COALESCE(NEW.vessel_type,'') || '|' || COALESCE(NEW.joining_date::text, NEW.source_posted_at::text, '') || '|' ||
      COALESCE(NEW.apply_url, NEW.source, ''), '\s+', '', 'g'));
  END IF;
  RETURN NEW;
END $function$;

UPDATE public.external_vacancies
SET expires_at = (COALESCE(source_posted_at, COALESCE(first_seen_at, created_at, now())::date) + INTERVAL '45 days')::timestamptz
WHERE is_scam_flagged = false;