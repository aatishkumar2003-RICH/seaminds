ALTER TABLE public.crew_training_assignments ADD COLUMN IF NOT EXISTS application_id uuid;

DROP FUNCTION IF EXISTS public.training_recommend(uuid, text, integer);
DROP FUNCTION IF EXISTS public.training_assign(uuid, text[], text);
DROP FUNCTION IF EXISTS public.training_ledger(uuid);
DROP FUNCTION IF EXISTS public.training_resolve_crew(uuid);

CREATE FUNCTION public.training_resolve_crew(p_invite_id uuid, p_application_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r record; uid uuid := auth.uid(); my_company text;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error_code', 'AUTH_REQUIRED'); END IF;
  IF p_application_id IS NOT NULL THEN
    SELECT lower(trim(company_name)) INTO my_company FROM manager_profiles WHERE user_id = uid;
    SELECT ja.crew_id, coalesce(jp.vessel_type, ja.vessel_type) AS vessel,
           (coalesce(jp.manager_id, cpo.manager_id) = uid
             OR (jp.id IS NOT NULL AND jp.manager_id IS NULL AND lower(trim(jp.company_name)) = my_company)) AS mine
      INTO r
      FROM job_applications ja
      LEFT JOIN job_postings jp ON jp.id = ja.job_posting_id
      LEFT JOIN company_posts cpo ON cpo.id = ja.company_post_id
     WHERE ja.id = p_application_id;
    IF r.crew_id IS NULL OR (NOT coalesce(r.mine, false) AND NOT is_admin(uid)) THEN
      RETURN jsonb_build_object('ok', false, 'error_code', 'FORBIDDEN'); END IF;
    RETURN jsonb_build_object('ok', true, 'crew_id', r.crew_id, 'vessel', r.vessel,
      'source', CASE WHEN coalesce(r.mine, false) THEN 'manager' ELSE 'admin' END);
  END IF;
  IF p_invite_id IS NULL THEN RETURN jsonb_build_object('ok', true, 'crew_id', uid, 'source', 'self'); END IF;
  SELECT i.crew_profile_id, c.manager_id, c.vessel_type INTO r
    FROM interview_invites i JOIN interview_campaigns c ON c.id = i.campaign_id WHERE i.id = p_invite_id;
  IF r.manager_id IS NULL OR (r.manager_id <> uid AND NOT is_admin(uid)) THEN RETURN jsonb_build_object('ok', false, 'error_code', 'FORBIDDEN'); END IF;
  IF r.crew_profile_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error_code', 'NOT_STARTED'); END IF;
  RETURN jsonb_build_object('ok', true, 'crew_id', r.crew_profile_id, 'vessel', r.vessel_type,
    'source', CASE WHEN r.manager_id = uid THEN 'manager' ELSE 'admin' END);
END $$;

CREATE FUNCTION public.training_recommend(p_invite_id uuid DEFAULT NULL, p_area text DEFAULT NULL, p_limit integer DEFAULT 3, p_application_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE who jsonb;
BEGIN
  who := training_resolve_crew(p_invite_id, p_application_id);
  IF NOT (who->>'ok')::boolean THEN RETURN who; END IF;
  RETURN training_recommend_core((who->>'crew_id')::uuid, nullif(upper(btrim(p_area)), ''), who->>'vessel', p_limit);
END $$;

CREATE FUNCTION public.training_assign(p_invite_id uuid DEFAULT NULL, p_slugs text[] DEFAULT NULL, p_area text DEFAULT NULL, p_application_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE who jsonb; rec jsonb; crew uuid; area text := nullif(upper(btrim(p_area)), ''); item jsonb; m record; outp jsonb := '[]'::jsonb; a record;
BEGIN
  who := training_resolve_crew(p_invite_id, p_application_id);
  IF NOT (who->>'ok')::boolean THEN RETURN who; END IF;
  IF who->>'source' = 'self' THEN RETURN jsonb_build_object('ok', false, 'error_code', 'FORBIDDEN'); END IF;
  crew := (who->>'crew_id')::uuid;
  IF p_slugs IS NOT NULL AND cardinality(p_slugs) > 5 THEN RETURN jsonb_build_object('ok', false, 'error_code', 'TOO_MANY'); END IF;
  rec := training_recommend_core(crew, area, who->>'vessel', 10);
  FOR item IN SELECT e FROM jsonb_array_elements(rec->'items') e
     WHERE (p_slugs IS NULL AND (e->>'score')::int > 0) OR (p_slugs IS NOT NULL AND e->>'slug' = ANY(p_slugs))
     LIMIT CASE WHEN p_slugs IS NULL THEN 2 ELSE 5 END
  LOOP
    SELECT id, version INTO m FROM training_modules WHERE slug = item->>'slug' AND is_published;
    INSERT INTO crew_training_assignments(crew_id, module_id, module_version, source, assigned_by, invite_id, application_id, trading_area, reasons, match_score)
    VALUES (crew, m.id, m.version, who->>'source', auth.uid(), p_invite_id, p_application_id, area, item->'reasons', (item->>'score')::int)
    ON CONFLICT (crew_id, module_id) DO UPDATE
      SET module_version = EXCLUDED.module_version, status = 'assigned', opened_at = NULL, completed_at = NULL,
          quiz_correct = NULL, quiz_total = NULL, attempts = 0, reasons = EXCLUDED.reasons, match_score = EXCLUDED.match_score
      WHERE crew_training_assignments.status = 'completed' AND crew_training_assignments.module_version < EXCLUDED.module_version;
    SELECT token, status, assigned_by INTO a FROM crew_training_assignments WHERE crew_id = crew AND module_id = m.id;
    outp := outp || jsonb_build_object('slug', item->>'slug', 'title', item->>'title', 'status', a.status,
      'token', CASE WHEN a.assigned_by = auth.uid() OR who->>'source' = 'admin' THEN a.token END);
  END LOOP;
  IF jsonb_array_length(outp) = 0 THEN RETURN jsonb_build_object('ok', false, 'error_code', 'NOTHING_TO_ASSIGN'); END IF;
  RETURN jsonb_build_object('ok', true, 'assigned', outp);
END $$;

CREATE FUNCTION public.training_ledger(p_invite_id uuid DEFAULT NULL, p_application_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE who jsonb; crew uuid; self boolean;
BEGIN
  who := training_resolve_crew(p_invite_id, p_application_id);
  IF NOT (who->>'ok')::boolean THEN RETURN who; END IF;
  crew := (who->>'crew_id')::uuid; self := who->>'source' = 'self';
  RETURN jsonb_build_object('ok', true, 'items', coalesce((
    SELECT jsonb_agg(jsonb_build_object('title', m.title, 'slug', m.slug, 'status', a.status, 'reasons', a.reasons,
      'assigned_at', a.created_at, 'opened_at', a.opened_at, 'completed_at', a.completed_at, 'dwell_seconds', a.dwell_seconds,
      'quiz_correct', a.quiz_correct, 'quiz_total', a.quiz_total, 'concepts', to_jsonb(m.concepts),
      'company', CASE WHEN a.source = 'self' THEN NULL ELSE mp.company_name END,
      'token', CASE WHEN self OR a.assigned_by = auth.uid() THEN a.token END) ORDER BY a.created_at DESC)
    FROM crew_training_assignments a JOIN training_modules m ON m.id = a.module_id
    LEFT JOIN manager_profiles mp ON mp.user_id = a.assigned_by
    WHERE a.crew_id = crew AND (self OR a.status = 'completed' OR a.assigned_by = auth.uid() OR is_admin(auth.uid()))), '[]'::jsonb));
END $$;

REVOKE ALL ON FUNCTION public.training_resolve_crew(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.training_recommend(uuid, text, integer, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.training_assign(uuid, text[], text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.training_ledger(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.training_recommend(uuid, text, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.training_assign(uuid, text[], text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.training_ledger(uuid, uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';