-- PENDING REVIEW — NOT APPLIED. Requires separate owner authorization.
-- Stage 2: manual vacancy lifecycle, admin-wide cleanup, safe delete, audit log.
-- job_postings.status has no CHECK constraint; none is added here.

-- 1. Archive mechanism for external vacancies (additive, nullable).
ALTER TABLE public.external_vacancies ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.external_vacancies ADD COLUMN IF NOT EXISTS archived_by uuid;

-- 2. Audit table.
CREATE TABLE IF NOT EXISTS public.vacancy_cleanup_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  actor_scope text NOT NULL CHECK (actor_scope IN ('manager','admin')),
  action text NOT NULL CHECK (action IN ('archive','restore','filled','reopen','delete')),
  vacancy_kind text NOT NULL CHECK (vacancy_kind IN ('direct','external')),
  vacancy_ids uuid[] NOT NULL,
  affected integer NOT NULL,
  filters jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.vacancy_cleanup_audit TO authenticated;
GRANT ALL ON public.vacancy_cleanup_audit TO service_role;
ALTER TABLE public.vacancy_cleanup_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin reads cleanup audit" ON public.vacancy_cleanup_audit FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "manager reads own cleanup audit" ON public.vacancy_cleanup_audit FOR SELECT TO authenticated USING (actor_id = auth.uid());
-- No INSERT policy: rows are written only by the SECURITY DEFINER RPC below.

-- 3. Admin read of all direct vacancies (incl. non-public).
CREATE POLICY "admin reads all job_postings" ON public.job_postings FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- 4. Single RPC for every manual lifecycle action (ownership + application guard + audit).
CREATE OR REPLACE FUNCTION public.vacancy_lifecycle_action(p_kind text, p_ids uuid[], p_action text, p_filters jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_admin boolean := public.is_admin(auth.uid()); v_n int := 0; v_apps int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_action NOT IN ('archive','restore','filled','reopen','delete') THEN RAISE EXCEPTION 'bad_action'; END IF;
  IF p_kind = 'external' AND NOT v_admin THEN RAISE EXCEPTION 'forbidden'; END IF;

  IF p_kind = 'direct' THEN
    IF NOT v_admin AND EXISTS (SELECT 1 FROM job_postings WHERE id = ANY(p_ids) AND manager_id <> v_uid) THEN
      RAISE EXCEPTION 'forbidden: not your vacancy';
    END IF;
    IF p_action = 'delete' THEN
      SELECT count(*) INTO v_apps FROM job_applications WHERE job_posting_id = ANY(p_ids);
      IF v_apps > 0 THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'has_applications', 'applications', v_apps);
      END IF;
      DELETE FROM job_postings WHERE id = ANY(p_ids);
    ELSE
      UPDATE job_postings SET status = CASE p_action WHEN 'archive' THEN 'archived' WHEN 'filled' THEN 'filled' ELSE 'active' END
       WHERE id = ANY(p_ids);
    END IF;
  ELSE
    IF p_action = 'delete' THEN DELETE FROM external_vacancies WHERE id = ANY(p_ids);
    ELSIF p_action = 'archive' THEN UPDATE external_vacancies SET archived_at = now(), archived_by = v_uid WHERE id = ANY(p_ids);
    ELSIF p_action = 'restore' THEN UPDATE external_vacancies SET archived_at = NULL, archived_by = NULL WHERE id = ANY(p_ids);
    ELSE RAISE EXCEPTION 'bad_action_for_external'; END IF;
  END IF;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  INSERT INTO vacancy_cleanup_audit(actor_id, actor_scope, action, vacancy_kind, vacancy_ids, affected, filters)
  VALUES (v_uid, CASE WHEN v_admin THEN 'admin' ELSE 'manager' END, p_action, p_kind, p_ids, v_n, p_filters);
  RETURN jsonb_build_object('ok', true, 'affected', v_n);
END $$;
REVOKE ALL ON FUNCTION public.vacancy_lifecycle_action(text, uuid[], text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vacancy_lifecycle_action(text, uuid[], text, jsonb) TO authenticated;

-- Feeds would then add: external_vacancies.archived_at IS NULL.
-- Previously expired direct postings (status='expired') are NOT reactivated.
