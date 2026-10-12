-- STATUS: NOT APPLIED. REVIEW ONLY. DO NOT EXECUTE WITHOUT SEPARATE OWNER AUTHORIZATION.
-- Source: SeaMinds_Stage2_secure_lifecycle_V2_REVIEW_ONLY.sql (replaces outdated V1 draft).
-- SeaMinds Stage 2 manual vacancy lifecycle — INDEPENDENT DRAFT V2, REVIEW ONLY.
-- NOT EXECUTED. NOT approved to run. Intended for controlled/staged activation.
-- Supersedes the unsafe supabase/pending-review/20261012120000_vacancy_lifecycle_admin_cleanup.sql draft.
-- Verified baseline: job_postings; external_vacancies; job_applications; manager_profiles; admin_profiles.
-- Product policy: Approved managers operate only on own direct postings; admins platform-wide.
-- No expiry automation. Manual archive/filled/restore/delete only. Applicant history protected.
-- CAUTION: NOT execution-tested. Requires separate approval and controlled validation before any live run. No staging environment was authorized.

BEGIN;

-- A. External archive state. No existing rows are automatically archived.
ALTER TABLE public.external_vacancies ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.external_vacancies ADD COLUMN IF NOT EXISTS archived_by uuid;
CREATE INDEX IF NOT EXISTS idx_external_unarchived_feed
  ON public.external_vacancies (created_at DESC, id DESC)
  WHERE archived_at IS NULL AND is_scam_flagged = false;

-- A2. Protect new external application links with a foreign key. Three older
-- job_applications.vacancy_id references do not match current external_vacancies;
-- NOT VALID deliberately preserves those legacy application records while
-- enforcing referential integrity for all NEW links and protected parent deletes.
-- Do NOT VALIDATE until the historical references have been investigated.
ALTER TABLE public.job_applications
  ADD CONSTRAINT job_applications_external_vacancy_link_fk
  FOREIGN KEY (vacancy_id) REFERENCES public.external_vacancies(id)
  ON DELETE RESTRICT NOT VALID;

-- B. Durable audit: actor and affected IDs are computed on the server, never trusted to caller.
CREATE TABLE IF NOT EXISTS public.vacancy_cleanup_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  actor_scope text NOT NULL CHECK (actor_scope IN ('manager','admin')),
  action text NOT NULL CHECK (action IN ('archive','restore','filled','reopen','delete')),
  vacancy_kind text NOT NULL CHECK (vacancy_kind IN ('direct','external')),
  requested_ids uuid[] NOT NULL,
  affected_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  blocked_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  affected_count integer NOT NULL DEFAULT 0,
  blocked_applications bigint NOT NULL DEFAULT 0,
  filters jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vacancy_cleanup_actor_date
  ON public.vacancy_cleanup_audit(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vacancy_cleanup_date
  ON public.vacancy_cleanup_audit(created_at DESC);
ALTER TABLE public.vacancy_cleanup_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vacancy_cleanup_audit FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.vacancy_cleanup_audit TO authenticated;
-- On first execution only: policy names must not already exist.
CREATE POLICY "vacancy_cleanup_admin_read" ON public.vacancy_cleanup_audit
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "vacancy_cleanup_manager_own_read" ON public.vacancy_cleanup_audit
  FOR SELECT TO authenticated USING (actor_id = auth.uid());

-- C. Permit actual admins to read non-public direct vacancies, including archived/filled.
CREATE POLICY "vacancy_admin_read_all_direct" ON public.job_postings
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- D. Authoritative MANAGER UI application counts. This signature and output
-- exactly match the present Preview frontend in src/lib/vacancyLifecycle.ts:
--   supabase.rpc("vacancy_application_counts", { p_ids: ids })
--   response rows { vacancy_id, applications }
-- The Manager panel only counts direct job_postings applications. Admin may
-- view direct counts as well; external protection is enforced by the action RPC.
-- SECURITY DEFINER avoids existing job_applications RLS visibility blind spots.
CREATE OR REPLACE FUNCTION public.vacancy_application_counts(p_ids uuid[])
RETURNS TABLE(vacancy_id uuid, applications bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_admin boolean := false;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  v_admin := public.is_admin(v_uid);
  IF p_ids IS NULL OR cardinality(p_ids) = 0 OR cardinality(p_ids) > 500
     OR EXISTS (SELECT 1 FROM unnest(p_ids) as i(id) WHERE i.id IS NULL) THEN
    RAISE EXCEPTION 'invalid_selection';
  END IF;
  IF NOT v_admin AND NOT EXISTS (
    SELECT 1 FROM public.manager_profiles mp
    WHERE mp.user_id = v_uid AND mp.admin_approved IS TRUE
  ) THEN RAISE EXCEPTION 'manager_not_approved'; END IF;

  RETURN QUERY
    SELECT jp.id, count(ja.id)::bigint
    FROM public.job_postings jp
    LEFT JOIN public.job_applications ja ON ja.job_posting_id = jp.id
    WHERE jp.id = ANY(p_ids) AND (v_admin OR jp.manager_id = v_uid)
    GROUP BY jp.id;
END;
$fn$;
REVOKE ALL ON FUNCTION public.vacancy_application_counts(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vacancy_application_counts(uuid[]) TO authenticated;

-- E. One intentional/manual lifecycle operation. Performs no automated cleanup.
-- For a mixed selection: deletes eligible postings, returns IDs protected by applications.
-- Frontend shows "N removed; M protected — Archive those instead" after one confirmation.
CREATE OR REPLACE FUNCTION public.vacancy_lifecycle_action(
  p_kind text, p_ids uuid[], p_action text, p_filters jsonb DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_admin boolean := false;
  v_ids uuid[] := '{}'::uuid[];
  v_changed uuid[] := '{}'::uuid[];
  v_blocked uuid[] := '{}'::uuid[];
  v_found integer := 0;
  v_blocked_apps bigint := 0;
  v_action_status text;
  v_affected integer := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  v_admin := public.is_admin(v_uid);
  IF p_kind IS NULL OR p_kind NOT IN ('direct','external') THEN RAISE EXCEPTION 'bad_kind'; END IF;
  IF p_action IS NULL OR p_action NOT IN ('archive','restore','filled','reopen','delete') THEN
    RAISE EXCEPTION 'bad_action';
  END IF;
  IF p_kind = 'external' AND p_action NOT IN ('archive','restore','delete') THEN
    RAISE EXCEPTION 'bad_action_for_external';
  END IF;
  IF p_ids IS NULL OR cardinality(p_ids) = 0 OR cardinality(p_ids) > 500 THEN
    RAISE EXCEPTION 'invalid_selection';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_ids) AS x(id) WHERE x.id IS NULL) THEN
    RAISE EXCEPTION 'invalid_selection';
  END IF;
  SELECT coalesce(array_agg(x.id ORDER BY x.id), '{}'::uuid[])
    INTO v_ids FROM (SELECT DISTINCT id FROM unnest(p_ids) AS v(id)) x;
  IF cardinality(v_ids) = 0 THEN RAISE EXCEPTION 'invalid_selection'; END IF;
  IF NOT v_admin AND NOT EXISTS (
    SELECT 1 FROM public.manager_profiles mp
    WHERE mp.user_id = v_uid AND mp.admin_approved IS TRUE
  ) THEN RAISE EXCEPTION 'manager_not_approved'; END IF;
  IF p_kind = 'external' AND NOT v_admin THEN RAISE EXCEPTION 'forbidden'; END IF;

  IF p_kind = 'direct' THEN
    -- Serialize with concurrent lifecycle operations; FK still protects against races
    -- with applications inserted concurrently.
    PERFORM 1 FROM public.job_postings jp WHERE jp.id = ANY(v_ids) FOR UPDATE;
    SELECT count(*) INTO v_found FROM public.job_postings jp WHERE jp.id = ANY(v_ids);
    IF v_found <> cardinality(v_ids) THEN RAISE EXCEPTION 'vacancy_not_found'; END IF;
    -- IS DISTINCT FROM intentionally rejects NULL manager_id for non-admins.
    IF NOT v_admin AND EXISTS (
      SELECT 1 FROM public.job_postings jp
      WHERE jp.id = ANY(v_ids) AND jp.manager_id IS DISTINCT FROM v_uid
    ) THEN RAISE EXCEPTION 'forbidden_not_owner'; END IF;

    IF p_action = 'delete' THEN
      SELECT coalesce(array_agg(t.id ORDER BY t.id), '{}'::uuid[])
      INTO v_blocked FROM (
        SELECT DISTINCT ja.job_posting_id AS id
        FROM public.job_applications ja WHERE ja.job_posting_id = ANY(v_ids)
      ) t;
      SELECT count(*) INTO v_blocked_apps
        FROM public.job_applications ja WHERE ja.job_posting_id = ANY(v_blocked);
      WITH removed AS (
        DELETE FROM public.job_postings jp
        WHERE jp.id = ANY(v_ids) AND NOT (jp.id = ANY(v_blocked))
        RETURNING jp.id
      ) SELECT coalesce(array_agg(id ORDER BY id), '{}'::uuid[]) INTO v_changed FROM removed;
    ELSE
      v_action_status := CASE p_action
        WHEN 'archive' THEN 'archived' WHEN 'filled' THEN 'filled'
        ELSE 'active' END;
      WITH changed AS (
        UPDATE public.job_postings jp SET status = v_action_status
        WHERE jp.id = ANY(v_ids)
          AND ((p_action = 'archive' AND jp.status IN ('active','filled'))
           OR (p_action = 'filled' AND jp.status = 'active')
           OR (p_action IN ('restore','reopen') AND jp.status IN ('archived','filled')))
        RETURNING jp.id
      ) SELECT coalesce(array_agg(id ORDER BY id), '{}'::uuid[]) INTO v_changed FROM changed;
    END IF;
  ELSE
    PERFORM 1 FROM public.external_vacancies ev WHERE ev.id = ANY(v_ids) FOR UPDATE;
    SELECT count(*) INTO v_found FROM public.external_vacancies ev WHERE ev.id = ANY(v_ids);
    IF v_found <> cardinality(v_ids) THEN RAISE EXCEPTION 'vacancy_not_found'; END IF;

    IF p_action = 'delete' THEN
      SELECT coalesce(array_agg(t.id ORDER BY t.id), '{}'::uuid[])
      INTO v_blocked FROM (
        SELECT DISTINCT ja.vacancy_id AS id FROM public.job_applications ja
        WHERE ja.vacancy_id = ANY(v_ids)
      ) t;
      SELECT count(*) INTO v_blocked_apps FROM public.job_applications ja
        WHERE ja.vacancy_id = ANY(v_blocked);
      WITH removed AS (
        DELETE FROM public.external_vacancies ev
        WHERE ev.id = ANY(v_ids) AND NOT (ev.id = ANY(v_blocked))
        RETURNING ev.id
      ) SELECT coalesce(array_agg(id ORDER BY id), '{}'::uuid[]) INTO v_changed FROM removed;
    ELSIF p_action = 'archive' THEN
      WITH changed AS (
        UPDATE public.external_vacancies ev
        SET archived_at = now(), archived_by = v_uid
        WHERE ev.id = ANY(v_ids) AND ev.archived_at IS NULL
        RETURNING ev.id
      ) SELECT coalesce(array_agg(id ORDER BY id), '{}'::uuid[]) INTO v_changed FROM changed;
    ELSE
      WITH changed AS (
        UPDATE public.external_vacancies ev
        SET archived_at = NULL, archived_by = NULL
        WHERE ev.id = ANY(v_ids) AND ev.archived_at IS NOT NULL
        RETURNING ev.id
      ) SELECT coalesce(array_agg(id ORDER BY id), '{}'::uuid[]) INTO v_changed FROM changed;
    END IF;
  END IF;

  v_affected := cardinality(v_changed);
  INSERT INTO public.vacancy_cleanup_audit (
    actor_id, actor_scope, action, vacancy_kind,
    requested_ids, affected_ids, blocked_ids, affected_count, blocked_applications, filters
  ) VALUES (
    v_uid, CASE WHEN v_admin THEN 'admin' ELSE 'manager' END,
    p_action, p_kind, v_ids, v_changed, v_blocked, v_affected, v_blocked_apps,
    CASE WHEN jsonb_typeof(p_filters) = 'object' THEN p_filters ELSE NULL END
  );

  RETURN jsonb_build_object(
    'ok', v_affected > 0 OR cardinality(v_blocked) = 0,
    'affected', v_affected,
    'affected_ids', v_changed,
    'blocked_applications', v_blocked_apps,
    'blocked_ids', v_blocked,
    'reason', CASE WHEN cardinality(v_blocked) > 0 THEN 'has_applications' ELSE NULL END
  );
END;
$fn$;
REVOKE ALL ON FUNCTION public.vacancy_lifecycle_action(text, uuid[], text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vacancy_lifecycle_action(text, uuid[], text, jsonb) TO authenticated;

COMMIT;