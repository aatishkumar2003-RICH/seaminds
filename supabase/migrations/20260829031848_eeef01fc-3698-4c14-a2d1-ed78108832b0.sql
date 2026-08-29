-- 1. Columns
ALTER TABLE public.job_postings
  ADD COLUMN IF NOT EXISTS positions integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS joining_date date,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS posting_batch_id uuid,
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'manual';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_postings_positions_check') THEN
    ALTER TABLE public.job_postings ADD CONSTRAINT job_postings_positions_check CHECK (positions >= 1);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_postings_source_type_check') THEN
    ALTER TABLE public.job_postings ADD CONSTRAINT job_postings_source_type_check
      CHECK (source_type IN ('manual','text','flier'));
  END IF;
END $$;

UPDATE public.job_postings
   SET expires_at = created_at + interval '14 days'
 WHERE expires_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_job_postings_batch ON public.job_postings (posting_batch_id);
CREATE INDEX IF NOT EXISTS idx_job_postings_manager_status ON public.job_postings (manager_id, status);

-- 2. Safe contact normalization + updated_at + verified company ownership (3)
CREATE OR REPLACE FUNCTION public.normalize_job_posting()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_raw text;
  v_digits text;
  v_company text;
BEGIN
  -- contact_whatsapp
  v_raw := nullif(btrim(coalesce(NEW.contact_whatsapp, '')), '');
  IF v_raw IS NOT NULL THEN
    IF left(v_raw, 1) = '+' THEN
      v_digits := regexp_replace(substr(v_raw, 2), '[^0-9]', '', 'g');
      NEW.contact_whatsapp := CASE WHEN v_digits = '' THEN v_raw ELSE '+' || v_digits END;
    ELSE
      v_digits := regexp_replace(v_raw, '[^0-9]', '', 'g');
      IF left(v_digits, 2) = '00' AND length(v_digits) > 2 THEN
        NEW.contact_whatsapp := '+' || substr(v_digits, 3);
      ELSE
        -- unclear/local numbers (incl. single leading zero) preserved verbatim
        NEW.contact_whatsapp := v_raw;
      END IF;
    END IF;
  END IF;

  -- contact_email
  IF NEW.contact_email IS NOT NULL THEN
    NEW.contact_email := nullif(lower(btrim(NEW.contact_email)), '');
  END IF;

  -- verified company ownership
  IF auth.uid() IS NOT NULL THEN
    SELECT mp.company_name INTO v_company
      FROM public.manager_profiles mp
     WHERE mp.user_id = auth.uid()
       AND coalesce(mp.admin_approved, false) = true
     LIMIT 1;
    IF v_company IS NOT NULL THEN
      NEW.manager_id := auth.uid();
      NEW.company_name := v_company;
      NEW.verified := true;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();
    NEW.created_at := OLD.created_at;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_auto_verify_posting ON public.job_postings;
DROP TRIGGER IF EXISTS trg_normalize_job_posting ON public.job_postings;
CREATE TRIGGER trg_normalize_job_posting
BEFORE INSERT OR UPDATE ON public.job_postings
FOR EACH ROW EXECUTE FUNCTION public.normalize_job_posting();

-- 4. RLS
DROP POLICY IF EXISTS "Authenticated users can insert job postings" ON public.job_postings;
DROP POLICY IF EXISTS "approved_managers_insert_postings" ON public.job_postings;
DROP POLICY IF EXISTS "approved_managers_update_own_postings" ON public.job_postings;
DROP POLICY IF EXISTS "approved_managers_delete_own_postings" ON public.job_postings;

CREATE POLICY "approved_managers_insert_postings"
ON public.job_postings FOR INSERT TO authenticated
WITH CHECK (
  manager_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.manager_profiles mp
     WHERE mp.user_id = auth.uid() AND coalesce(mp.admin_approved, false) = true
  )
);

CREATE POLICY "approved_managers_update_own_postings"
ON public.job_postings FOR UPDATE TO authenticated
USING (
  manager_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.manager_profiles mp
     WHERE mp.user_id = auth.uid() AND coalesce(mp.admin_approved, false) = true
  )
)
WITH CHECK (manager_id = auth.uid());

CREATE POLICY "approved_managers_delete_own_postings"
ON public.job_postings FOR DELETE TO authenticated
USING (
  manager_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.manager_profiles mp
     WHERE mp.user_id = auth.uid() AND coalesce(mp.admin_approved, false) = true
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_postings TO authenticated;
GRANT SELECT ON public.job_postings TO anon;
GRANT ALL ON public.job_postings TO service_role;

-- 5. Application history protection
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_applications_job_posting_id_fkey') THEN
    ALTER TABLE public.job_applications
      ADD CONSTRAINT job_applications_job_posting_id_fkey
      FOREIGN KEY (job_posting_id) REFERENCES public.job_postings(id)
      ON DELETE RESTRICT NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  ALTER TABLE public.job_applications VALIDATE CONSTRAINT job_applications_job_posting_id_fkey;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'FK left NOT VALID (legacy orphan rows preserved): %', SQLERRM;
END $$;

-- 6. Expiry engine
CREATE OR REPLACE FUNCTION public.expire_old_vacancies()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n_purged int := 0; n_posts int := 0; n_ads int := 0;
BEGIN
  DELETE FROM external_vacancies WHERE expires_at < now() - interval '60 days';
  GET DIAGNOSTICS n_purged = ROW_COUNT;

  -- direct company postings expire on their own expires_at (extendable)
  UPDATE job_postings SET status = 'expired'
   WHERE status = 'active' AND expires_at <= now();
  GET DIAGNOSTICS n_posts = ROW_COUNT;

  UPDATE company_posts SET status = 'expired'
   WHERE status = 'live' AND created_at < now() - interval '14 days';
  GET DIAGNOSTICS n_ads = ROW_COUNT;

  INSERT INTO app_events (event_type, message, severity)
  VALUES ('vacancy_expiry',
          format('expiry sweep: purged %s ancient externals, expired %s postings, %s adverts', n_purged, n_posts, n_ads),
          'info');
  RETURN format('purged %s, expired %s postings, %s adverts', n_purged, n_posts, n_ads);
EXCEPTION WHEN OTHERS THEN RETURN 'skipped: ' || SQLERRM;
END $$;

NOTIFY pgrst, 'reload schema';