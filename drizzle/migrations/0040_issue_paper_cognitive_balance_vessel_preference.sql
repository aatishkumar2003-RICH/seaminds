-- Flexible cognitive balancing (~30% recall / 50% application / 20% judgment for MCQs, never a hard quota)
-- and vessel preference from the frozen evidence snapshot (General fallback). Paper sizes unchanged.
CREATE OR REPLACE FUNCTION public.issue_paper(p_assessment_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  rubric_gaps jsonb := '[]'::jsonb;
  uid uuid := auth.uid(); a record; ctx jsonb; bp record; req jsonb; need int; got int;
  shortfalls jsonb := '[]'::jsonb; picked uuid[] := '{}'; it record; n int; perm int[]; opts jsonb; newc int;
  pid uuid := gen_random_uuid(); disp jsonb := '[]'::jsonb; keys jsonb := '[]'::jsonb; k int := 0; pi text;
  admin boolean; rgroup text; existing record; vctx text; ver int; v_entry text; v_reqs jsonb;
  cand text[] := '{}'; tR int; tA int; tJ int; dist jsonb;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error_code', 'AUTH_REQUIRED'); END IF;
  SELECT id, crew_profile_id, preflight_context, preflight_confirmed_at, assessment_mode, interview_mode, evidence_snapshot INTO a
    FROM smc_assessments WHERE id = p_assessment_id FOR UPDATE;
  IF a.id IS NULL OR a.crew_profile_id <> uid THEN RETURN jsonb_build_object('ok', false, 'error_code', 'NOT_FOUND'); END IF;
  IF a.preflight_confirmed_at IS NULL OR a.preflight_context IS NULL OR NOT coalesce((a.preflight_context->>'ok')::boolean, false) THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'PREFLIGHT_REQUIRED');
  END IF;
  ctx := a.preflight_context;
  v_entry := CASE WHEN a.interview_mode = 'company' THEN 'MANAGER' ELSE coalesce(a.assessment_mode, 'PROFILE') END;

  INSERT INTO assessment_checkpoints(assessment_id, crew_profile_id, lifecycle_state) VALUES (p_assessment_id, uid, 'PREPARING')
  ON CONFLICT (assessment_id) DO NOTHING;

  SELECT * INTO existing FROM issued_papers WHERE assessment_id = p_assessment_id AND status = 'ISSUED';
  IF existing.id IS NOT NULL THEN
    UPDATE assessment_checkpoints SET paper_id = existing.id, delivered_at = coalesce(delivered_at, now()), last_seen_at = now() WHERE assessment_id = p_assessment_id;
    RETURN jsonb_build_object('ok', true, 'paper_id', existing.id, 'paper_version', existing.paper_version, 'blueprint_version', existing.blueprint_version,
      'is_test', existing.is_test, 'context', existing.context, 'items', existing.items, 'issued_at', existing.issued_at);
  END IF;
  IF EXISTS (SELECT 1 FROM issued_papers WHERE assessment_id = p_assessment_id AND status <> 'SUPERSEDED_SYSTEM_ERROR') THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'PAPER_CLOSED');
  END IF;
  SELECT coalesce(max(paper_version), 0) + 1 INTO ver FROM issued_papers WHERE assessment_id = p_assessment_id;

  admin := is_admin(uid);
  vctx := coalesce(ctx->>'vessel_context', 'General');

  -- Vessel preference: frozen CV sea service + campaign target vessel (never live CV data)
  IF jsonb_typeof(a.evidence_snapshot->'cv'->'sea_service') = 'array' THEN
    SELECT coalesce(array_agg(DISTINCT lower(trim(v->>'vessel_type'))), '{}') INTO cand
      FROM jsonb_array_elements(a.evidence_snapshot->'cv'->'sea_service') v
     WHERE jsonb_typeof(v) = 'object' AND nullif(trim(coalesce(v->>'vessel_type','')), '') IS NOT NULL;
  END IF;
  IF nullif(trim(coalesce(a.evidence_snapshot->'target'->>'vessel_type','')), '') IS NOT NULL THEN
    cand := cand || lower(trim(a.evidence_snapshot->'target'->>'vessel_type'));
  END IF;
  IF vctx <> 'General' THEN cand := cand || lower(vctx); END IF;

  SELECT * INTO bp FROM assessment_blueprints b
   WHERE b.status = 'ACTIVE' AND b.canonical_rank = ctx->>'canonical_rank' AND b.department = ctx->>'department' AND b.level = ctx->>'level'
     AND b.vessel_context IN (vctx, 'General') AND (NOT b.is_test OR admin)
   ORDER BY b.is_test ASC, (b.vessel_context = vctx) DESC, b.blueprint_version DESC LIMIT 1;
  IF bp.id IS NULL THEN
    INSERT INTO app_events(event_type, message, severity, user_id, metadata)
    VALUES ('paper_not_ready', 'no active blueprint', 'warning', uid, jsonb_build_object('assessment_id', p_assessment_id, 'context', ctx));
    PERFORM _start_incident_upsert(uid, p_assessment_id, 'CONTENT_NOT_READY', 'PAPER_NOT_READY', 'rpc:issue_paper', NULL, NULL);
    RETURN jsonb_build_object('ok', false, 'error_code', 'PAPER_NOT_READY', 'reason', 'NO_ACTIVE_BLUEPRINT', 'context', ctx);
  END IF;
  v_reqs := coalesce(bp.requirements_by_mode->v_entry, bp.requirements);

  rgroup := CASE WHEN ctx->>'rank_group' LIKE '%OFFICER' THEN 'OFFICER' ELSE 'RATING' END;
  FOR req IN SELECT * FROM jsonb_array_elements(v_reqs) LOOP
    need := coalesce((req->>'count')::int, 0); got := 0;
    IF req->>'item_type' = 'mcq' AND req->>'cognitive_level' IS NULL THEN
      tR := round(need * 0.3); tA := round(need * 0.5); tJ := greatest(need - tR - tA, 0);
    ELSE
      tR := need; tA := need; tJ := need;
    END IF;
    FOR it IN
      WITH pool AS (
        SELECT i.*,
               EXISTS (SELECT 1 FROM unnest(i.vessel_scope) s WHERE lower(s) = ANY(cand)) AS vmatch,
               row_number() OVER (PARTITION BY i.cognitive_level ORDER BY
                 EXISTS (SELECT 1 FROM unnest(i.vessel_scope) s WHERE lower(s) = ANY(cand)) DESC,
                 (i.approval_status = 'SME_APPROVED') DESC, i.exposure_count ASC, random()) AS rn
          FROM assessment_items i
         WHERE i.is_active AND NOT (i.id = ANY(picked))
           AND i.question_type = req->>'item_type'
           AND (req->>'domain' IS NULL OR i.domain = req->>'domain')
           AND (req->>'cognitive_level' IS NULL OR i.cognitive_level = req->>'cognitive_level')
           AND (bp.is_test OR i.vessel_scope && ARRAY[vctx, 'General'] OR EXISTS (SELECT 1 FROM unnest(i.vessel_scope) s WHERE lower(s) = ANY(cand)))
           AND (
             (i.approval_status IN ('SME_APPROVED','AI_VALIDATED') AND (ctx->>'canonical_rank') = ANY(i.rank_scope))
             OR (bp.is_test AND i.approval_status IN ('TEST_ONLY','LEGACY_REVIEW_REQUIRED')
                 AND ((ctx->>'canonical_rank') = ANY(i.rank_scope) OR (i.rank_scope = '{}' AND i.legacy_rank_group = rgroup)))
           )
      )
      SELECT * FROM pool
       ORDER BY (rn <= CASE cognitive_level WHEN 'recall' THEN tR WHEN 'application' THEN tA WHEN 'judgment' THEN tJ ELSE need END) DESC,
                vmatch DESC, (approval_status = 'SME_APPROVED') DESC, exposure_count ASC, random()
       LIMIT need
    LOOP
      picked := picked || it.id; got := got + 1; k := k + 1; pi := 'p' || k;
      IF it.question_type = 'mcq' THEN
        n := jsonb_array_length(it.prompt->'options');
        SELECT array_agg(g ORDER BY random()) INTO perm FROM generate_series(0, n - 1) g;
        SELECT jsonb_agg(to_jsonb(regexp_replace(it.prompt->'options'->>perm[x], '^\s*[A-Ea-e][.)]\s+', '')) ORDER BY x) INTO opts FROM generate_series(1, n) x;
        newc := array_position(perm, (it.answer_key->>'correct_index')::int) - 1;
        disp := disp || jsonb_strip_nulls(jsonb_build_object('paper_item_id', pi, 'type', 'mcq', 'domain', it.domain, 'question', it.prompt->>'question', 'options', opts,
          'level', it.cognitive_level, 'weight', req->'weight'));
        keys := keys || jsonb_build_object('pi', pi, 'item', it.id, 'v', it.question_version,
          'key', jsonb_build_object('correct_index', newc, 'correct_letter', chr(65 + newc), 'explanation', it.answer_key->>'explanation', 'regulation', it.answer_key->>'regulation', 'option_order', to_jsonb(perm)));
      ELSE
        disp := disp || jsonb_strip_nulls(jsonb_build_object('paper_item_id', pi, 'type', it.question_type, 'domain', it.domain, 'question', it.prompt->>'question',
          'situation', it.prompt->>'situation', 'category', it.prompt->>'category', 'prompt_text', it.prompt->>'prompt_text', 'time_seconds', (it.prompt->>'time_seconds')::int,
          'level', it.cognitive_level, 'weight', req->'weight'));
        IF jsonb_typeof(it.answer_key->'key_steps') IS DISTINCT FROM 'array' OR jsonb_array_length(coalesce(it.answer_key->'key_steps','[]'::jsonb)) = 0 THEN
          rubric_gaps := rubric_gaps || jsonb_build_object('paper_item_id', pi, 'item_id', it.id, 'item_version', it.question_version);
        END IF;
        keys := keys || jsonb_build_object('pi', pi, 'item', it.id, 'v', it.question_version, 'key', it.answer_key || jsonb_build_object('rubric_version', it.question_version));
      END IF;
    END LOOP;
    IF got < need THEN shortfalls := shortfalls || jsonb_build_object('requirement', req, 'available', got, 'required', need); END IF;
  END LOOP;

  IF jsonb_array_length(shortfalls) > 0 OR k = 0 THEN
    INSERT INTO app_events(event_type, message, severity, user_id, metadata)
    VALUES ('blueprint_incomplete', 'inventory does not satisfy blueprint', 'warning', uid,
            jsonb_build_object('assessment_id', p_assessment_id, 'blueprint_id', bp.id, 'entry', v_entry, 'shortfalls', shortfalls));
    PERFORM _start_incident_upsert(uid, p_assessment_id, 'CONTENT_NOT_READY', 'BLUEPRINT_INCOMPLETE', 'rpc:issue_paper', NULL, NULL);
    RETURN jsonb_build_object('ok', false, 'error_code', 'BLUEPRINT_INCOMPLETE', 'blueprint_version', bp.blueprint_version, 'shortfalls', shortfalls);
  END IF;

  SELECT jsonb_agg(e ORDER BY CASE e->>'type' WHEN 'mcq' THEN 1 WHEN 'scenario' THEN 2 ELSE 3 END, o) INTO disp
    FROM jsonb_array_elements(disp) WITH ORDINALITY t(e, o);

  SELECT coalesce(jsonb_object_agg(lvl, c), '{}'::jsonb) INTO dist FROM (
    SELECT coalesce(e->>'level', 'unspecified') lvl, count(*) c FROM jsonb_array_elements(disp) e WHERE e->>'type' = 'mcq' GROUP BY 1) s;
  ctx := ctx || jsonb_build_object('cognitive_distribution', dist, 'vessel_preference', to_jsonb(cand));

  INSERT INTO issued_papers(id, assessment_id, crew_profile_id, paper_version, blueprint_id, blueprint_version, is_test, context, items)
  VALUES (pid, p_assessment_id, uid, ver, bp.id, bp.blueprint_version, bp.is_test, ctx || jsonb_build_object('entry', v_entry), disp);
  INSERT INTO issued_paper_keys(paper_id, paper_item_id, item_id, item_version, answer_key)
  SELECT pid, e->>'pi', (e->>'item')::uuid, (e->>'v')::int, e->'key' FROM jsonb_array_elements(keys) e;
  UPDATE assessment_items SET exposure_count = exposure_count + 1 WHERE id = ANY(picked);
  UPDATE paper_supersessions SET new_paper_id = pid WHERE assessment_id = p_assessment_id AND new_paper_id IS NULL;
  UPDATE assessment_checkpoints SET paper_id = pid, lifecycle_state = 'READY', delivered_at = now(), current_index = 0, last_seen_at = now(), updated_at = now()
   WHERE assessment_id = p_assessment_id;
  INSERT INTO assessment_state_log(assessment_id, paper_id, actor, event, to_state, reason, source)
  VALUES (p_assessment_id, pid, uid, 'PAPER_ISSUED', 'READY', 'v' || ver, 'server');
  IF jsonb_array_length(rubric_gaps) > 0 THEN
    INSERT INTO app_events(event_type, message, severity, user_id, metadata)
    VALUES ('rubric_coverage_gap', 'issued paper has open-answer items without a key_steps rubric', 'warning', uid,
            jsonb_build_object('assessment_id', p_assessment_id, 'paper_id', pid, 'items', rubric_gaps));
  END IF;
  UPDATE assessment_start_incidents SET status = 'RESOLVED', resolved_at = now() WHERE assessment_id = p_assessment_id AND status = 'OPEN';
  UPDATE recovery_cases SET status = 'RESUMED', next_action_at = NULL, updated_at = now()
   WHERE assessment_id = p_assessment_id AND phase = 'PRE_PAPER' AND status NOT IN ('RESUMED','COMPLETED','CLOSED');

  RETURN jsonb_build_object('ok', true, 'paper_id', pid, 'paper_version', ver, 'blueprint_version', bp.blueprint_version,
    'is_test', bp.is_test, 'context', ctx || jsonb_build_object('entry', v_entry), 'items', disp, 'issued_at', now());
END $function$;
NOTIFY pgrst, 'reload schema';