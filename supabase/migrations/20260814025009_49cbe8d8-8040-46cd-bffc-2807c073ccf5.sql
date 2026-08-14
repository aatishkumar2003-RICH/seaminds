ALTER TABLE public.external_vacancies
  ADD COLUMN IF NOT EXISTS source_posted_at date,
  ADD COLUMN IF NOT EXISTS dedup_key text;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_vacancy_dedup ON public.external_vacancies (dedup_key) WHERE dedup_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.enforce_vacancy_freshness()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.expires_at := LEAST(
    COALESCE(NEW.expires_at, 'infinity'::timestamptz),
    (COALESCE(NEW.source_posted_at, COALESCE(NEW.fetched_at, now())::date) + INTERVAL '14 days')::timestamptz
  );
  IF NEW.dedup_key IS NULL THEN
    NEW.dedup_key := lower(regexp_replace(
      COALESCE(NEW.company_name,'') || '|' || COALESCE(NEW.rank_required,'') || '|' ||
      COALESCE(NEW.vessel_type,'') || '|' || COALESCE(NEW.joining_date::text, NEW.source_posted_at::text, '') || '|' ||
      COALESCE(NEW.apply_url, NEW.source, ''), '\s+', '', 'g'));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_vacancy_freshness ON public.external_vacancies;
CREATE TRIGGER trg_vacancy_freshness BEFORE INSERT OR UPDATE ON public.external_vacancies
FOR EACH ROW EXECUTE FUNCTION public.enforce_vacancy_freshness();