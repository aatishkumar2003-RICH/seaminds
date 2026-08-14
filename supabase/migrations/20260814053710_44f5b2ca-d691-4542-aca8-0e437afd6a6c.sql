ALTER TABLE public.external_vacancies
  ADD COLUMN IF NOT EXISTS first_seen_at timestamptz NOT NULL DEFAULT now();

UPDATE public.external_vacancies SET first_seen_at = COALESCE(fetched_at, created_at, now()) WHERE first_seen_at > COALESCE(fetched_at, created_at, now());

CREATE OR REPLACE FUNCTION public.enforce_vacancy_freshness()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.first_seen_at := OLD.first_seen_at;
  END IF;
  NEW.expires_at := LEAST(
    COALESCE(NEW.expires_at, 'infinity'::timestamptz),
    (COALESCE(NEW.source_posted_at, COALESCE(NEW.first_seen_at, now())::date) + INTERVAL '14 days')::timestamptz
  );
  IF NEW.dedup_key IS NULL THEN
    NEW.dedup_key := lower(regexp_replace(
      COALESCE(NEW.company_name,'') || '|' || COALESCE(NEW.rank_required,'') || '|' ||
      COALESCE(NEW.vessel_type,'') || '|' || COALESCE(NEW.joining_date::text, NEW.source_posted_at::text, '') || '|' ||
      COALESCE(NEW.apply_url, NEW.source, ''), '\s+', '', 'g'));
  END IF;
  RETURN NEW;
END $$;

ALTER TABLE public.smc_assessments
  ADD COLUMN IF NOT EXISTS probed_claims jsonb DEFAULT '[]';