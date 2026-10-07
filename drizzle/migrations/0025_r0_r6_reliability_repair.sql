-- 0025 R0–R6 reliability repair: P0 edge cases, startup incidents, honest health gate,
-- durable recovery outbox, verified resume, single-flight final scoring, worker correctness.

CREATE TABLE IF NOT EXISTS public.assessment_start_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.smc_assessments(id) ON DELETE CASCADE,
  crew_profile_id uuid NOT NULL,
  category text NOT NULL CHECK (category IN ('CONTENT_NOT_READY','CONNECTIVITY','BACKEND_FAILURE','USER_PAUSED','CANDIDATE_ACTION_REQUIRED','CLIENT_OUTDATED','UNATTRIBUTED')),
  error_code text NOT NULL,
  fn_path text,
  correlation_id text,
  client_build text,
  context jsonb,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','RESOLVED')),
  occurrences int NOT NULL DEFAULT 1,
  first_at timestamptz NOT NULL DEFAULT now(),
  last_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS start_incidents_open_uq ON public.assessment_start_incidents(assessment_id, category, error_code) WHERE status = 'OPEN';
GRANT ALL ON public.assessment_start_incidents TO service_role;
GRANT SELECT ON public.assessment_start_incidents TO authenticated;
ALTER TABLE public.assessment_start_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read start incidents" ON public.assessment_start_incidents FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.recovery_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.recovery_cases(id) ON DELETE CASCADE,
  reminder_no int NOT NULL,
  message_key text NOT NULL UNIQUE,
  token_hash text,
  link_token text,
  phase text NOT NULL DEFAULT 'IN_PAPER',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','LEASED','FAILED','ACCEPTED','DEAD')),
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 5,
  lease_until timestamptz,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  provider_message_id text,
  accepted_at timestamptz,
  delivery_status text NOT NULL DEFAULT 'UNKNOWN' CHECK (delivery_status IN ('UNKNOWN','NOT_CONFIGURED','AWAITING_CALLBACK','DELIVERED','BOUNCED','COMPLAINED')),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, reminder_no)
);
COMMENT ON COLUMN public.recovery_outbox.link_token IS 'Raw single-use resume token, service-role only; cleared on ACCEPTED/DEAD. Redemption uses recovery_tokens.token_hash.';
GRANT ALL ON public.recovery_outbox TO service_role;
ALTER TABLE public.recovery_outbox ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.recovery_cases ADD COLUMN IF NOT EXISTS phase text NOT NULL DEFAULT 'IN_PAPER';
ALTER TABLE public.scoring_jobs ADD COLUMN IF NOT EXISTS lease_until timestamptz;
ALTER TABLE public.scoring_jobs ADD COLUMN IF NOT EXISTS retry_at timestamptz;
ALTER TABLE public.scoring_jobs ADD COLUMN IF NOT EXISTS final_failures int NOT NULL DEFAULT 0;
ALTER TABLE public.scoring_jobs ADD COLUMN IF NOT EXISTS ai_result jsonb;
ALTER TABLE public.scoring_jobs ADD COLUMN IF NOT EXISTS ai_result_paper uuid;

CREATE OR REPLACE FUNCTION public._start_incident_upsert(p_uid uuid, p_assessment uuid, p_category text, p_code text, p_path text, p_corr text, p_build text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE a record; iid uuid; pol jsonb := recovery_policy(); cid uuid; m text;
BEGIN
  SELECT id, crew_profile_id, preflight_context INTO a FROM smc_assessments WHERE id = p_assessment AND crew_profile_id = p_uid;
  IF a.id IS NULL THEN RETURN NULL; END IF;
  IF EXISTS (SELECT 1 FROM issued_papers WHERE assessment_id = p_assessment AND status IN ('ISSUED','COMPLETED')) THEN RETURN NULL; END IF;
  INSERT INTO assessment_start_incidents(assessment_id, crew_profile_id, category, error_code, fn_path, correlation_id, client_build, context)
  VALUES (p_assessment, p_uid, p_category, left(p_code, 60), left(p_path, 80), left(p_corr, 64), left(p_build, 80),
          jsonb_build_object('canonical_rank', a.preflight_context->>'canonical_rank', 'department', a.preflight_context->>'department',
                             'level', a.preflight_context->>'level', 'vessel_context', a.preflight_context->>'vessel_context'))
  ON CONFLICT (assessment_id, category, error_code) WHERE status = 'OPEN'
  DO UPDATE SET occurrences = assessment_start_incidents.occurrences + 1, last_at = now(),
     correlation_id = coalesce(EXCLUDED.correlation_id, assessment_start_incidents.correlation_id),
     client_build = coalesce(EXCLUDED.client_build, assessment_start_incidents.client_build)
  RETURNING id INTO iid;
  IF p_category IN ('CONTENT_NOT_READY','BACKEND_FAILURE') THEN
    SELECT id INTO cid FROM recovery_cases WHERE assessment_id = p_assessment AND status NOT IN ('RESUMED','COMPLETED','CLOSED') LIMIT 1;
    IF cid IS NULL THEN
      m := CASE WHEN EXISTS (SELECT 1 FROM interview_progress WHERE assessment_id = p_assessment) THEN 'company' ELSE 'self' END;
      INSERT INTO recovery_cases(assessment_id, crew_profile_id, mode, interruption_state, phase, next_action_at, is_test)
      VALUES (p_assessment, p_uid, m, 'START_' || p_category, 'PRE_PAPER',
              now() + make_interval(mins => coalesce((pol->>'first_delay_minutes')::int, 10)), is_admin(p_uid))
      RETURNING id INTO cid;
      PERFORM recovery_log(cid, 'START_INCIDENT_RECORDED', jsonb_build_object('category', p_category, 'code', left(p_code, 60)));
    END IF;
  END IF;
  RETURN iid;
END $$;

CREATE OR REPLACE FUNCTION public.blueprint_coverage_for(p_bp uuid, p_rank text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE bp record; req jsonb; need int; got int; picked uuid[] := '{}'; ids uuid[]; shortfalls jsonb := '[]'::jsonb; rgroup text; vctx text;
BEGIN
  SELECT * INTO bp FROM assessment_blueprints WHERE id = p_bp;
  IF bp.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'blueprint_not_ready'); END IF;
  SELECT CASE WHEN rank_group LIKE '%OFFICER' THEN 'OFFICER' ELSE 'RATING' END INTO rgroup FROM rank_taxonomy WHERE canonical_rank = p_rank LIMIT 1;
  vctx := bp.vessel_context;
  FOR req IN SELECT * FROM jsonb_array_elements(bp.requirements) LOOP
    need := coalesce((req->>'count')::int, 0);
    SELECT array_agg(s.id) INTO ids FROM (
      SELECT i.id FROM assessment_items i
       WHERE i.is_active AND NOT (i.id = ANY(picked)) AND i.question_type = req->>'item_type'
         AND (req->>'domain' IS NULL OR i.domain = req->>'domain')
         AND (req->>'cognitive_level' IS NULL OR i.cognitive_level = req->>'cognitive_level')
         AND (bp.is_test OR i.vessel_scope && ARRAY[vctx, 'General'])
         AND ((i.approval_status = 'SME_APPROVED' AND p_rank = ANY(i.rank_scope))
              OR (bp.is_test AND i.approval_status IN ('TEST_ONLY','LEGACY_REVIEW_REQUIRED')
                  AND (p_rank = ANY(i.rank_scope) OR (i.rank_scope = '{}' AND i.legacy_rank_group = rgroup))))
       ORDER BY i.id LIMIT need) s;
    got := coalesce(array_length(ids, 1), 0);
    picked := picked || coalesce(ids, '{}');
    IF got < need THEN shortfalls := shortfalls || jsonb_build_object('item_type', req->>'item_type', 'domain', req->>'domain', 'available', got, 'required', need); END IF;
  END LOOP;
  RETURN jsonb_build_object('ok', jsonb_array_length(shortfalls) = 0 AND jsonb_array_length(bp.requirements) > 0,
    'reason', CASE WHEN jsonb_array_length(shortfalls) = 0 AND jsonb_array_length(bp.requirements) > 0 THEN NULL ELSE 'inventory_incomplete' END,
    'blueprint_id', bp.id, 'blueprint_version', bp.blueprint_version, 'is_test', bp.is_test, 'shortfalls', shortfalls);
END $$;

CREATE OR REPLACE FUNCTION public.blueprint_coverage(p_ctx jsonb, p_include_test boolean)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE bpid uuid; vctx text := coalesce(p_ctx->>'vessel_context', 'General');
BEGIN
  IF coalesce(p_ctx->>'canonical_rank','') = '' THEN RETURN jsonb_build_object('ok', false, 'reason', 'context_invalid'); END IF;
  SELECT b.id INTO bpid FROM assessment_blueprints b
   WHERE b.status = 'ACTIVE' AND b.canonical_rank = p_ctx->>'canonical_rank' AND b.department = p_ctx->>'department' AND b.level = p_ctx->>'level'
     AND b.vessel_context IN (vctx, 'General') AND (NOT b.is_test OR p_include_test)
   ORDER BY b.is_test ASC, (b.vessel_context = vctx) DESC, b.blueprint_version DESC LIMIT 1;
  IF bpid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'blueprint_not_ready'); END IF;
  RETURN blueprint_coverage_for(bpid, p_ctx->>'canonical_rank');
END $$;

CREATE OR REPLACE FUNCTION public.record_start_incident(p_assessment_id uuid, p_kind text, p_error_code text, p_path text DEFAULT NULL, p_correlation text DEFAULT NULL, p_build text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid(); a record; k text := upper(coalesce(p_kind,'')); code text := upper(left(coalesce(p_error_code,'UNKNOWN'), 60)); cat text; iid uuid; cov jsonb;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error_code', 'AUTH_REQUIRED'); END IF;
  SELECT id, preflight_context INTO a FROM smc_assessments WHERE id = p_assessment_id AND crew_profile_id = uid;
  IF a.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error_code', 'NOT_FOUND'); END IF;
  IF NOT candidate_rate_ok(uid, p_assessment_id, 'start_incident', 20, interval '10 minutes', NULL) THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'RATE_LIMITED'); END IF;
  IF code IN ('PAPER_NOT_READY','BLUEPRINT_INCOMPLETE','NO_ACTIVE_BLUEPRINT','POOL_UNAVAILABLE') THEN
    cov := blueprint_coverage(a.preflight_context, is_admin(uid));
    cat := CASE WHEN coalesce((cov->>'ok')::boolean, false) THEN 'UNATTRIBUTED' ELSE 'CONTENT_NOT_READY' END;
  ELSIF code IN ('UNRESOLVED_RANK','PREFLIGHT_REQUIRED','RANK_MISMATCH','VALIDATION','INVALID_INPUT','BAD_REQUEST') THEN cat := 'CANDIDATE_ACTION_REQUIRED';
  ELSIF k = 'CONNECTIVITY' THEN cat := 'CONNECTIVITY';
  ELSIF k = 'BACKEND_FAILURE' AND code ~ '^(HTTP_5|RPC_SERVER_ERROR|EDGE_FUNCTION_ERROR)' THEN cat := 'BACKEND_FAILURE';
  ELSIF k = 'USER_PAUSED' THEN cat := 'USER_PAUSED';
  ELSE cat := 'UNATTRIBUTED'; END IF;
  iid := _start_incident_upsert(uid, p_assessment_id, cat, code, p_path, p_correlation, p_build);
  RETURN jsonb_build_object('ok', true, 'category', cat, 'incident_id', iid, 'recoverable', cat IN ('CONTENT_NOT_READY','BACKEND_FAILURE'));
END $$;

CREATE OR REPLACE FUNCTION public.issue_paper(p_assessment_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  rubric_gaps jsonb := '[]'::jsonb;
  uid uuid := auth.uid(); a record; ctx jsonb; bp record; req jsonb; need int; got int;
  shortfalls jsonb := '[]'::jsonb; picked uuid[] := '{}'; it record; n int; perm int[]; opts jsonb; newc int;
  pid uuid := gen_random_uuid(); disp jsonb := '[]'::jsonb; keys jsonb := '[]'::jsonb; k int := 0; pi text;
  admin boolean; rgroup text; existing record; vctx text; ver int;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error_code', 'AUTH_REQUIRED'); END IF;
  SELECT id, crew_profile_id, preflight_context, preflight_confirmed_at INTO a FROM smc_assessments WHERE id = p_assessment_id FOR UPDATE;
  IF a.id IS NULL OR a.crew_profile_id <> uid THEN RETURN jsonb_build_object('ok', false, 'error_code', 'NOT_FOUND'); END IF;
  IF a.preflight_confirmed_at IS NULL OR a.preflight_context IS NULL OR NOT coalesce((a.preflight_context->>'ok')::boolean, false) THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'PREFLIGHT_REQUIRED');
  END IF;
  ctx := a.preflight_context;

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

  rgroup := CASE WHEN ctx->>'rank_group' LIKE '%OFFICER' THEN 'OFFICER' ELSE 'RATING' END;
  FOR req IN SELECT * FROM jsonb_array_elements(bp.requirements) LOOP
    need := coalesce((req->>'count')::int, 0); got := 0;
    FOR it IN
      SELECT i.* FROM assessment_items i
       WHERE i.is_active AND NOT (i.id = ANY(picked))
         AND i.question_type = req->>'item_type'
         AND (req->>'domain' IS NULL OR i.domain = req->>'domain')
         AND (req->>'cognitive_level' IS NULL OR i.cognitive_level = req->>'cognitive_level')
         AND (bp.is_test OR i.vessel_scope && ARRAY[vctx, 'General'])
         AND (
           (i.approval_status = 'SME_APPROVED' AND (ctx->>'canonical_rank') = ANY(i.rank_scope))
           OR (bp.is_test AND i.approval_status IN ('TEST_ONLY','LEGACY_REVIEW_REQUIRED')
               AND ((ctx->>'canonical_rank') = ANY(i.rank_scope) OR (i.rank_scope = '{}' AND i.legacy_rank_group = rgroup)))
         )
       ORDER BY i.exposure_count ASC, random() LIMIT need
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
            jsonb_build_object('assessment_id', p_assessment_id, 'blueprint_id', bp.id, 'shortfalls', shortfalls));
    PERFORM _start_incident_upsert(uid, p_assessment_id, 'CONTENT_NOT_READY', 'BLUEPRINT_INCOMPLETE', 'rpc:issue_paper', NULL, NULL);
    RETURN jsonb_build_object('ok', false, 'error_code', 'BLUEPRINT_INCOMPLETE', 'blueprint_version', bp.blueprint_version, 'shortfalls', shortfalls);
  END IF;

  SELECT jsonb_agg(e ORDER BY CASE e->>'type' WHEN 'mcq' THEN 1 WHEN 'scenario' THEN 2 ELSE 3 END, o) INTO disp
    FROM jsonb_array_elements(disp) WITH ORDINALITY t(e, o);

  INSERT INTO issued_papers(id, assessment_id, crew_profile_id, paper_version, blueprint_id, blueprint_version, is_test, context, items)
  VALUES (pid, p_assessment_id, uid, ver, bp.id, bp.blueprint_version, bp.is_test, ctx, disp);
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
    'is_test', bp.is_test, 'context', ctx, 'items', disp, 'issued_at', now());
END $function$;

CREATE OR REPLACE FUNCTION public.finalize_assessment_commit(p_assessment_id uuid, p_paper_id uuid, p_caller uuid, p_scores jsonb, p_level_profile jsonb, p_red_flags jsonb, p_certificate_id text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE a record; pp record; prep jsonb; v_ok boolean; k text; n int; cert text := p_certificate_id;
BEGIN
  SELECT * INTO a FROM smc_assessments WHERE id = p_assessment_id FOR UPDATE;
  IF a.id IS NULL THEN RETURN jsonb_build_object('ok',false,'error_code','NOT_FOUND'); END IF;
  IF p_caller IS NOT NULL AND a.crew_profile_id IS DISTINCT FROM p_caller THEN
    RETURN jsonb_build_object('ok',false,'error_code','FORBIDDEN'); END IF;
  IF a.status = 'completed' AND a.overall_score IS NOT NULL THEN
    RETURN jsonb_build_object('ok',true,'already_completed',true,'certificate_id',a.certificate_id,
      'scores', jsonb_build_object('technical',a.technical_score,'judgment',a.judgment_score,'english',a.english_score,
        'behaviour',a.behavioural_score,'overall',a.overall_score,'band',a.score_band,'recommendation',a.recommendation,
        'scoring_version',a.scoring_version,'level_profile',a.level_profile));
  END IF;
  FOREACH k IN ARRAY ARRAY['technical','judgment','english','behaviour','overall'] LOOP
    v_ok := coalesce(jsonb_typeof(p_scores->k) = 'number' AND (p_scores->>k)::numeric BETWEEN 0 AND 5, false);
    IF NOT v_ok THEN RETURN jsonb_build_object('ok',false,'error_code','INVALID_SCORES','field',k); END IF;
  END LOOP;
  IF coalesce(p_scores->>'band','') = '' OR coalesce(p_scores->>'recommendation','') = '' OR coalesce(cert,'') = '' THEN
    RETURN jsonb_build_object('ok',false,'error_code','INVALID_SCORES','field','band/recommendation/certificate'); END IF;
  SELECT * INTO pp FROM issued_papers WHERE id = p_paper_id AND assessment_id = p_assessment_id FOR UPDATE;
  IF pp.id IS NULL OR pp.crew_profile_id IS DISTINCT FROM a.crew_profile_id OR pp.status NOT IN ('ISSUED','COMPLETED') THEN
    RETURN jsonb_build_object('ok',false,'error_code','PAPER_REQUIRED'); END IF;
  prep := finalize_assessment_prepare(p_assessment_id, a.crew_profile_id);
  IF NOT coalesce((prep->>'ok')::boolean, false) THEN
    RETURN jsonb_build_object('ok',false,'error_code','STALE_PREPARE','detail',prep->>'error_code'); END IF;
  IF (prep->>'paper_id')::uuid IS DISTINCT FROM p_paper_id THEN
    RETURN jsonb_build_object('ok',false,'error_code','STALE_PREPARE','detail','PAPER_CHANGED'); END IF;
  IF EXISTS (SELECT 1 FROM smc_assessments WHERE certificate_id = cert AND id <> p_assessment_id) THEN
    cert := cert || '-' || upper(substr(replace(p_assessment_id::text,'-',''), 9, 4));
    IF EXISTS (SELECT 1 FROM smc_assessments WHERE certificate_id = cert AND id <> p_assessment_id) THEN
      RETURN jsonb_build_object('ok',false,'error_code','CERTIFICATE_COLLISION'); END IF;
  END IF;

  UPDATE smc_assessments SET
    technical_score = (p_scores->>'technical')::numeric, judgment_score = (p_scores->>'judgment')::numeric,
    english_score = (p_scores->>'english')::numeric, behavioural_score = (p_scores->>'behaviour')::numeric,
    overall_score = (p_scores->>'overall')::numeric, level_profile = p_level_profile,
    score_band = p_scores->>'band', recommendation = p_scores->>'recommendation', scoring_version = 'v1.1',
    certificate_id = cert,
    dimension_scores = jsonb_build_object('technical',(p_scores->>'technical')::numeric,'judgment',(p_scores->>'judgment')::numeric,
      'maritime_english',(p_scores->>'english')::numeric,'professional_behaviour',(p_scores->>'behaviour')::numeric),
    red_flags = coalesce(p_red_flags,'[]'::jsonb), status = 'completed', completed_at = now()
  WHERE id = p_assessment_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'PERSIST_FAILED'; END IF;
  UPDATE issued_papers SET status = 'COMPLETED' WHERE id = p_paper_id AND status = 'ISSUED';
  UPDATE scoring_jobs SET status = 'done', completed_at = now(), lease_until = NULL WHERE assessment_id = p_assessment_id AND status <> 'done';
  INSERT INTO assessment_state_log(assessment_id, paper_id, actor, event, from_state, to_state, reason, source)
  VALUES (p_assessment_id, p_paper_id, p_caller, 'FINALIZED', a.status, 'completed', 'server finalization', 'score-assessment');
  RETURN jsonb_build_object('ok',true,'already_completed',false,'certificate_id',cert);
END $function$;

CREATE OR REPLACE FUNCTION public.complete_interview(p_invite_id uuid, p_assessment_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); inv record; a record; n int;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok',false,'error_code','AUTH_REQUIRED'); END IF;
  SELECT * INTO inv FROM interview_invites WHERE id = p_invite_id AND crew_profile_id = uid FOR UPDATE;
  IF inv.id IS NULL THEN RETURN jsonb_build_object('ok',false,'error_code','NOT_FOUND'); END IF;
  IF inv.status = 'completed' THEN
    IF inv.assessment_id IS DISTINCT FROM p_assessment_id THEN RETURN jsonb_build_object('ok',false,'error_code','ALREADY_COMPLETED'); END IF;
    SELECT * INTO a FROM smc_assessments WHERE id = p_assessment_id AND crew_profile_id = uid;
    IF inv.overall_score IS NULL OR NOT (inv.overall_score BETWEEN 0 AND 5) OR a.id IS NULL OR a.status <> 'completed'
       OR a.overall_score IS NULL OR NOT (a.overall_score BETWEEN 0 AND 5) THEN
      RETURN jsonb_build_object('ok',false,'error_code','RESULT_INVALID'); END IF;
    RETURN jsonb_build_object('ok',true,'already_completed',true,'score',inv.overall_score);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM interview_progress WHERE invite_id = p_invite_id AND crew_id = uid
                 AND assessment_id = p_assessment_id AND campaign_id = inv.campaign_id) THEN
    RETURN jsonb_build_object('ok',false,'error_code','BINDING_MISMATCH'); END IF;
  SELECT * INTO a FROM smc_assessments WHERE id = p_assessment_id AND crew_profile_id = uid;
  IF a.id IS NULL THEN RETURN jsonb_build_object('ok',false,'error_code','NOT_FOUND'); END IF;
  IF a.status <> 'completed' OR a.overall_score IS NULL OR NOT (a.overall_score BETWEEN 0 AND 5)
     OR NOT EXISTS (SELECT 1 FROM issued_papers WHERE assessment_id = p_assessment_id AND status = 'COMPLETED') THEN
    RETURN jsonb_build_object('ok',false,'error_code','SCORING_PENDING'); END IF;
  UPDATE interview_invites SET status = 'completed', assessment_id = p_assessment_id,
         overall_score = a.overall_score, completed_at = now()
   WHERE id = p_invite_id AND crew_profile_id = uid AND status <> 'completed';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RETURN jsonb_build_object('ok',false,'error_code','UPDATE_FAILED'); END IF;
  RETURN jsonb_build_object('ok',true,'already_completed',false,'score',a.overall_score);
END $function$;

CREATE OR REPLACE FUNCTION public.recovery_health_check(p_assessment_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE a record; ctx jsonb; paper record; blockers text[] := '{}'; camp record; b text; cov jsonb; adm boolean;
  phase text := 'IN_PAPER'; n_items int := 0; n_led int := 0; paper_ok boolean := true; submit_ok boolean := true; scoring_ok boolean := true;
BEGIN
  SELECT id, status, crew_profile_id, preflight_context, preflight_confirmed_at INTO a FROM smc_assessments WHERE id = p_assessment_id;
  IF a.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'blockers', jsonb_build_array('assessment_missing')); END IF;
  IF a.status = 'completed' THEN blockers := array_append(blockers, 'already_completed'); END IF;
  ctx := a.preflight_context;
  adm := is_admin(a.crew_profile_id);
  IF a.preflight_confirmed_at IS NULL OR NOT coalesce((ctx->>'ok')::boolean, false) OR ctx->>'canonical_rank' IS NULL THEN
    blockers := array_append(blockers, 'context_invalid'); paper_ok := false; END IF;
  SELECT * INTO paper FROM issued_papers WHERE assessment_id = p_assessment_id AND status = 'ISSUED';
  IF paper.id IS NULL THEN
    IF EXISTS (SELECT 1 FROM issued_papers WHERE assessment_id = p_assessment_id AND status <> 'SUPERSEDED_SYSTEM_ERROR') THEN
      blockers := array_append(blockers, 'paper_closed'); paper_ok := false;
    ELSE
      phase := 'PRE_PAPER';
      cov := blueprint_coverage(ctx, adm);
      IF NOT coalesce((cov->>'ok')::boolean, false) THEN blockers := array_append(blockers, coalesce(cov->>'reason', 'blueprint_not_ready')); paper_ok := false; END IF;
    END IF;
  ELSE
    IF paper.crew_profile_id IS DISTINCT FROM a.crew_profile_id THEN blockers := array_append(blockers, 'paper_owner_mismatch'); paper_ok := false; END IF;
    IF paper.context->>'canonical_rank' IS DISTINCT FROM ctx->>'canonical_rank' OR coalesce(paper.context->>'department','') IS DISTINCT FROM coalesce(ctx->>'department','')
       OR coalesce(paper.context->>'level','') IS DISTINCT FROM coalesce(ctx->>'level','') THEN
      blockers := array_append(blockers, 'paper_context_mismatch'); paper_ok := false; END IF;
    n_items := coalesce(jsonb_array_length(paper.items), 0);
    IF n_items = 0 THEN blockers := array_append(blockers, 'paper_empty'); paper_ok := false; END IF;
    IF NOT EXISTS (SELECT 1 FROM assessment_checkpoints WHERE assessment_id = p_assessment_id AND crew_profile_id = a.crew_profile_id) THEN
      blockers := array_append(blockers, 'checkpoint_missing'); submit_ok := false; END IF;
    SELECT count(*) INTO n_led FROM answer_ledger WHERE paper_id = paper.id;
    IF n_items > 0 AND n_led >= n_items THEN phase := 'SCORING'; END IF;
  END IF;
  SELECT value INTO b FROM admin_settings WHERE key = 'smc_backoff:' || p_assessment_id::text;
  IF b IS NOT NULL AND coalesce((CASE WHEN b ~ '^\s*\{' THEN b::jsonb->>'until' END)::bigint, 0) > (extract(epoch FROM now()) * 1000) THEN
    blockers := array_append(blockers, 'paper_backoff_active'); paper_ok := false; END IF;
  IF EXISTS (SELECT 1 FROM admin_settings WHERE key = 'ai_kill_switch' AND lower(trim(value)) = 'true') THEN
    blockers := array_append(blockers, 'ai_paused'); scoring_ok := false; END IF;
  IF EXISTS (SELECT 1 FROM app_events WHERE event_type = 'final_scoring_retry' AND message = 'ai_unconfigured' AND created_at > now() - interval '24 hours') THEN
    blockers := array_append(blockers, 'ai_unconfigured'); scoring_ok := false; END IF;
  IF EXISTS (SELECT 1 FROM answer_scoring_jobs WHERE assessment_id = p_assessment_id AND (status = 'dead' OR (status = 'running' AND attempts >= max_attempts AND next_attempt_at <= now()))) THEN
    blockers := array_append(blockers, 'scoring_dead_letter'); scoring_ok := false; END IF;
  IF EXISTS (SELECT 1 FROM answer_scoring_jobs WHERE assessment_id = p_assessment_id AND status IN ('pending','running') AND created_at < now() - interval '2 hours') THEN
    blockers := array_append(blockers, 'scoring_queue_stalled'); scoring_ok := false; END IF;
  IF EXISTS (SELECT 1 FROM scoring_jobs WHERE assessment_id = p_assessment_id AND status = 'failed') THEN
    blockers := array_append(blockers, 'finalization_failed'); scoring_ok := false; END IF;
  IF EXISTS (SELECT 1 FROM app_events WHERE event_type = 'final_scoring_retry' AND metadata->>'assessment_id' = p_assessment_id::text AND created_at > now() - interval '30 minutes') THEN
    blockers := array_append(blockers, 'final_scoring_degraded'); scoring_ok := false; END IF;
  IF EXISTS (SELECT 1 FROM assessment_start_incidents WHERE assessment_id = p_assessment_id AND category = 'BACKEND_FAILURE' AND last_at > now() - interval '15 minutes')
     OR EXISTS (SELECT 1 FROM assessment_checkpoints WHERE assessment_id = p_assessment_id AND interruption_state = 'SYSTEM_INTERRUPTED' AND interrupted_at > now() - interval '15 minutes'
                AND NOT EXISTS (SELECT 1 FROM recovery_cases rc WHERE rc.assessment_id = p_assessment_id AND rc.is_test)) THEN
    blockers := array_append(blockers, 'recent_backend_failure'); END IF;
  SELECT c.status, c.closes_at INTO camp FROM interview_progress ip JOIN interview_campaigns c ON c.id = ip.campaign_id WHERE ip.assessment_id = p_assessment_id LIMIT 1;
  IF FOUND AND ((camp.closes_at IS NOT NULL AND camp.closes_at < now()) OR coalesce(camp.status, 'open') IN ('closed','cancelled','archived')) THEN
    blockers := array_append(blockers, 'campaign_closed');
  END IF;
  RETURN jsonb_build_object('ok', cardinality(blockers) = 0, 'blockers', to_jsonb(blockers), 'checked_at', now(),
    'phase', phase, 'has_active_paper', paper.id IS NOT NULL,
    'capabilities', jsonb_build_object('paper_available', paper_ok, 'answer_submission', submit_ok AND phase <> 'PRE_PAPER', 'scoring', scoring_ok));
END $function$;

CREATE OR REPLACE FUNCTION public.recovery_claim_due(p_assessment_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 20)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $function$
DECLARE pol jsonb := recovery_policy(); c record; h jsonb; raw text; out jsonb := '[]'::jsonb; em text; fn text; route text; itok text;
  hours jsonb := coalesce(pol->'reminder_hours', '[]'::jsonb); sup text; ph text; rn int; oid uuid; th text;
BEGIN
  SELECT value INTO sup FROM admin_settings WHERE key = 'support_contact_email'
    AND EXISTS (SELECT 1 FROM admin_settings WHERE key = 'support_contact_verified' AND value = 'true');
  FOR c IN SELECT * FROM recovery_cases
    WHERE status IN ('OPEN','HEALTH_BLOCKED','NOTIFIED','NOTIFY_FAILED') AND next_action_at IS NOT NULL
      AND (p_assessment_id IS NULL AND next_action_at <= now() OR assessment_id = p_assessment_id)
    ORDER BY next_action_at LIMIT p_limit FOR UPDATE SKIP LOCKED
  LOOP
    IF EXISTS (SELECT 1 FROM recovery_outbox WHERE case_id = c.id AND status IN ('PENDING','LEASED','FAILED')) THEN CONTINUE; END IF;
    h := recovery_health_check(c.assessment_id);
    PERFORM recovery_log(c.id, 'HEALTH_CHECK', h);
    IF NOT (h->>'ok')::boolean THEN
      IF h->'blockers' ? 'already_completed' OR h->'blockers' ? 'campaign_closed' OR h->'blockers' ? 'paper_closed' THEN
        UPDATE recovery_cases SET status = 'CLOSED', next_action_at = NULL, last_health = h, updated_at = now() WHERE id = c.id;
        UPDATE recovery_tokens SET revoked_at = now() WHERE case_id = c.id AND used_at IS NULL AND revoked_at IS NULL;
        PERFORM recovery_log(c.id, 'CLOSED', h->'blockers');
      ELSE
        UPDATE recovery_cases SET status = 'HEALTH_BLOCKED', last_health = h, phase = coalesce(h->>'phase', phase), updated_at = now(),
          next_action_at = now() + make_interval(mins => coalesce((pol->>'recheck_minutes')::int, 30)) WHERE id = c.id;
      END IF;
      CONTINUE;
    END IF;
    IF c.reminders_sent > jsonb_array_length(hours) THEN
      UPDATE recovery_cases SET next_action_at = NULL, updated_at = now() WHERE id = c.id;
      PERFORM recovery_log(c.id, 'REMINDERS_EXHAUSTED', NULL);
      CONTINUE;
    END IF;
    ph := coalesce(h->>'phase', 'IN_PAPER');
    rn := c.reminders_sent + 1;
    UPDATE recovery_tokens SET revoked_at = now() WHERE case_id = c.id AND used_at IS NULL AND revoked_at IS NULL;
    raw := encode(gen_random_bytes(32), 'hex'); th := encode(digest(raw, 'sha256'), 'hex');
    INSERT INTO recovery_tokens(token_hash, case_id, assessment_id, crew_profile_id, expires_at)
    VALUES (th, c.id, c.assessment_id, c.crew_profile_id, now() + make_interval(mins => coalesce((pol->>'token_ttl_minutes')::int, 60)));
    SELECT i.token INTO itok FROM interview_progress ip JOIN interview_invites i ON i.id = ip.invite_id WHERE ip.assessment_id = c.assessment_id LIMIT 1;
    route := CASE WHEN c.mode = 'company' AND itok IS NOT NULL THEN '/interview/' || itok || '/exam' ELSE '/app' END;
    SELECT u.email, coalesce(cp.first_name, '') INTO em, fn FROM auth.users u LEFT JOIN crew_profiles cp ON cp.id = u.id WHERE u.id = c.crew_profile_id;
    INSERT INTO recovery_outbox(case_id, reminder_no, message_key, token_hash, link_token, phase, payload)
    VALUES (c.id, rn, 'recovery-' || c.id || '-' || rn || '-' || substr(th, 1, 8), th, raw, ph,
            jsonb_build_object('email', em, 'first_name', fn, 'mode', c.mode, 'support_email', sup, 'is_test', c.is_test, 'route', route))
    ON CONFLICT (case_id, reminder_no) DO NOTHING RETURNING id INTO oid;
    IF oid IS NULL THEN CONTINUE; END IF;
    UPDATE recovery_cases SET status = 'RECOVERABLE', phase = ph, last_health = h, next_action_at = NULL, updated_at = now() WHERE id = c.id;
    PERFORM recovery_log(c.id, 'RECOVERABLE', jsonb_build_object('reminder', rn, 'phase', ph, 'outbox_id', oid));
    IF rn = 1 THEN
      INSERT INTO notifications(crew_id, kind, title, body, icon, screen, link)
      VALUES (c.crew_profile_id, 'assessment_recovery',
        CASE ph WHEN 'PRE_PAPER' THEN 'Your assessment can now start' WHEN 'SCORING' THEN 'Your assessment result is being finalised' ELSE 'Your assessment is ready to resume' END,
        CASE ph WHEN 'PRE_PAPER' THEN 'Earlier your question paper was not available. A paper for your rank is now available. You are not penalised and can start when ready.'
                WHEN 'SCORING' THEN 'All your answers are saved. Scoring is working again — open SeaMinds to see your result. You do not need to retake anything.'
                ELSE 'An earlier interruption was a technical issue. Your attempt and saved answers are preserved, you are not penalised, and you can continue where you left off.' END,
        '⚓', CASE WHEN c.mode = 'self' THEN 'smc' END, CASE WHEN c.mode = 'company' THEN route END);
      PERFORM recovery_log(c.id, 'IN_APP_MESSAGE_CREATED', jsonb_build_object('phase', ph));
    END IF;
    IF sup IS NULL THEN PERFORM recovery_log(c.id, 'SUPPORT_CONTACT_NOT_CONFIGURED', NULL); END IF;
    out := out || jsonb_build_object('case_id', c.id, 'outbox_id', oid, 'reminder', rn, 'phase', ph);
  END LOOP;
  RETURN out;
END $function$;

CREATE OR REPLACE FUNCTION public.recovery_outbox_lease(p_case uuid DEFAULT NULL, p_limit int DEFAULT 10)
RETURNS TABLE(id uuid, case_id uuid, message_key text, link_token text, phase text, payload jsonb, attempts int, reminder_no int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
#variable_conflict use_column
DECLARE r record;
BEGIN
  FOR r IN UPDATE recovery_outbox o SET status = 'DEAD', link_token = NULL, lease_until = NULL, updated_at = now(),
             last_error = coalesce(o.last_error, '') || CASE WHEN o.attempts >= o.max_attempts THEN ' | attempts_exhausted' ELSE ' | link_expired' END
           WHERE o.status IN ('PENDING','FAILED','LEASED') AND (o.status <> 'LEASED' OR o.lease_until < now())
             AND (o.attempts >= o.max_attempts OR EXISTS (SELECT 1 FROM recovery_tokens t WHERE t.token_hash = o.token_hash AND (t.expires_at < now() + interval '5 minutes' OR t.revoked_at IS NOT NULL OR t.used_at IS NOT NULL)))
           RETURNING o.case_id AS cid, o.last_error AS err, o.attempts AS att LOOP
    UPDATE recovery_cases SET status = 'NOTIFY_FAILED', updated_at = now(),
      next_action_at = CASE WHEN r.err LIKE '%link_expired' THEN now() ELSE NULL END
     WHERE recovery_cases.id = r.cid AND recovery_cases.status = 'RECOVERABLE';
    PERFORM recovery_log(r.cid, 'EMAIL_FAILED', jsonb_build_object('error', left(r.err, 120), 'attempts', r.att, 'final', true));
  END LOOP;
  RETURN QUERY
  UPDATE recovery_outbox o SET status = 'LEASED', attempts = o.attempts + 1, lease_until = now() + interval '3 minutes', updated_at = now()
   WHERE o.id IN (SELECT x.id FROM recovery_outbox x
                   WHERE ((x.status IN ('PENDING','FAILED') AND x.next_attempt_at <= now()) OR (x.status = 'LEASED' AND x.lease_until < now()))
                     AND x.attempts < x.max_attempts AND (p_case IS NULL OR x.case_id = p_case)
                   ORDER BY x.created_at LIMIT p_limit FOR UPDATE SKIP LOCKED)
  RETURNING o.id, o.case_id, o.message_key, o.link_token, o.phase, o.payload, o.attempts, o.reminder_no;
END $$;

CREATE OR REPLACE FUNCTION public.recovery_outbox_result(p_id uuid, p_attempt int, p_ok boolean, p_provider_id text, p_error text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE o record; pol jsonb := recovery_policy(); hours jsonb := coalesce(pol->'reminder_hours','[]'::jsonb); nxt timestamptz; dead boolean; hook boolean; err text;
BEGIN
  SELECT * INTO o FROM recovery_outbox WHERE id = p_id FOR UPDATE;
  IF o.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error_code', 'NOT_FOUND'); END IF;
  IF o.status <> 'LEASED' OR o.attempts <> p_attempt THEN RETURN jsonb_build_object('ok', false, 'error_code', 'STALE_LEASE', 'status', o.status); END IF;
  IF p_ok AND coalesce(trim(p_provider_id), '') <> '' AND length(p_provider_id) <= 200 THEN
    hook := EXISTS (SELECT 1 FROM admin_settings WHERE key = 'email_delivery_webhook_configured' AND value = 'true');
    UPDATE recovery_outbox SET status = 'ACCEPTED', provider_message_id = p_provider_id, accepted_at = now(), link_token = NULL, lease_until = NULL,
      last_error = NULL, delivery_status = CASE WHEN hook THEN 'AWAITING_CALLBACK' ELSE 'NOT_CONFIGURED' END, updated_at = now() WHERE id = p_id;
    nxt := CASE WHEN o.reminder_no <= jsonb_array_length(hours) THEN now() + make_interval(hours => (hours->>(o.reminder_no - 1))::int) ELSE NULL END;
    UPDATE recovery_cases SET status = 'NOTIFIED', reminders_sent = greatest(reminders_sent, o.reminder_no), next_action_at = nxt, updated_at = now()
     WHERE id = o.case_id AND status = 'RECOVERABLE';
    PERFORM recovery_log(o.case_id, 'EMAIL_ACCEPTED', jsonb_build_object('provider_message_id', left(p_provider_id, 80), 'attempt', p_attempt, 'delivery_tracking', CASE WHEN hook THEN 'AWAITING_CALLBACK' ELSE 'NOT_CONFIGURED' END));
    RETURN jsonb_build_object('ok', true, 'status', 'ACCEPTED');
  END IF;
  err := left(coalesce(CASE WHEN p_ok THEN 'provider_response_missing_id' ELSE p_error END, 'unknown'), 200);
  dead := o.attempts >= o.max_attempts;
  UPDATE recovery_outbox SET status = CASE WHEN dead THEN 'DEAD' ELSE 'FAILED' END, lease_until = NULL,
    link_token = CASE WHEN dead THEN NULL ELSE link_token END, last_error = err,
    next_attempt_at = now() + make_interval(mins => least(power(2, o.attempts)::int, 30)), updated_at = now() WHERE id = p_id;
  IF dead THEN UPDATE recovery_cases SET status = 'NOTIFY_FAILED', next_action_at = NULL, updated_at = now() WHERE id = o.case_id AND status = 'RECOVERABLE'; END IF;
  PERFORM recovery_log(o.case_id, CASE WHEN dead THEN 'EMAIL_FAILED' ELSE 'EMAIL_RETRY_SCHEDULED' END,
    jsonb_build_object('error', left(err, 120), 'attempt', p_attempt, 'final', dead));
  RETURN jsonb_build_object('ok', true, 'status', CASE WHEN dead THEN 'DEAD' ELSE 'FAILED' END);
END $$;

CREATE OR REPLACE FUNCTION public.process_recovery_queue()
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_secret text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM recovery_cases WHERE status IN ('OPEN','HEALTH_BLOCKED','NOTIFIED','NOTIFY_FAILED') AND next_action_at <= now())
     AND NOT EXISTS (SELECT 1 FROM recovery_outbox WHERE (status IN ('PENDING','FAILED') AND next_attempt_at <= now()) OR (status = 'LEASED' AND lease_until < now())) THEN
    RETURN 'idle'; END IF;
  SELECT value INTO v_secret FROM admin_settings WHERE key = 'scoring_worker_secret';
  PERFORM net.http_post(
    url := 'https://luomzexqgcjtcmdlbevo.supabase.co/functions/v1/recovery-notify',
    headers := jsonb_build_object('Content-Type','application/json','x-worker-secret', coalesce(v_secret,''),
      'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1b216ZXhxZ2NqdGNtZGxiZXZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0OTY4NjEsImV4cCI6MjA4NzA3Mjg2MX0.QJoLu7WC-9h4qoTEXfOMPu1OJTmu8hzBuOGLPOq1IuY'),
    body := '{}'::jsonb, timeout_milliseconds := 55000);
  RETURN 'kicked';
END $function$;

CREATE OR REPLACE FUNCTION public.save_checkpoint(p_assessment_id uuid, p_current_index integer, p_elapsed_seconds integer DEFAULT NULL::integer)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); p record; c record; idx int;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error_code', 'AUTH_REQUIRED'); END IF;
  SELECT id, crew_profile_id, jsonb_array_length(items) n INTO p FROM issued_papers WHERE assessment_id = p_assessment_id AND status = 'ISSUED';
  IF p.id IS NULL OR p.crew_profile_id <> uid THEN RETURN jsonb_build_object('ok', false, 'error_code', 'NOT_FOUND'); END IF;
  SELECT * INTO c FROM assessment_checkpoints WHERE assessment_id = p_assessment_id FOR UPDATE;
  IF c.assessment_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error_code', 'CHECKPOINT_MISSING'); END IF;
  idx := LEAST(GREATEST(coalesce(p_current_index, 0), 0), p.n);
  UPDATE assessment_checkpoints SET paper_id = p.id,
    lifecycle_state = CASE WHEN interruption_state IS NULL THEN 'IN_PROGRESS' ELSE lifecycle_state END,
    elapsed_seconds = CASE WHEN idx > current_index THEN GREATEST(coalesce(p_elapsed_seconds, 0), 0)
                           WHEN idx = current_index THEN GREATEST(elapsed_seconds, coalesce(p_elapsed_seconds, elapsed_seconds))
                           ELSE elapsed_seconds END,
    current_index = GREATEST(current_index, idx),
    last_seen_at = now(), updated_at = now()
  WHERE assessment_id = p_assessment_id;
  RETURN jsonb_build_object('ok', true, 'interrupted', c.interruption_state IS NOT NULL);
END $function$;

CREATE OR REPLACE FUNCTION public.confirm_resume(p_assessment_id uuid, p_paper_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid(); p record; c record;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error_code', 'AUTH_REQUIRED'); END IF;
  SELECT id, crew_profile_id INTO p FROM issued_papers WHERE assessment_id = p_assessment_id AND status = 'ISSUED';
  IF p.id IS NULL OR p.crew_profile_id <> uid THEN RETURN jsonb_build_object('ok', false, 'error_code', 'NOT_FOUND'); END IF;
  IF p.id <> p_paper_id THEN RETURN jsonb_build_object('ok', false, 'error_code', 'PAPER_CHANGED'); END IF;
  SELECT * INTO c FROM assessment_checkpoints WHERE assessment_id = p_assessment_id FOR UPDATE;
  IF c.assessment_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error_code', 'CHECKPOINT_MISSING'); END IF;
  IF c.interruption_state IS NULL THEN RETURN jsonb_build_object('ok', true, 'already', true); END IF;
  INSERT INTO assessment_state_log(assessment_id, paper_id, actor, event, from_state, to_state, reason, source)
  VALUES (p_assessment_id, p.id, uid, 'RESUMED', c.interruption_state, 'IN_PROGRESS', 'verified: same paper fetched and answer persisted', 'candidate');
  UPDATE assessment_checkpoints SET lifecycle_state = 'IN_PROGRESS', interruption_state = NULL, interruption_reason = NULL, interrupted_at = NULL,
    last_seen_at = now(), updated_at = now() WHERE assessment_id = p_assessment_id;
  RETURN jsonb_build_object('ok', true, 'already', false);
END $$;

CREATE OR REPLACE FUNCTION public.get_resume_state(p_assessment_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); p record; c record; ans jsonb; nxt int;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error_code', 'AUTH_REQUIRED'); END IF;
  SELECT * INTO p FROM issued_papers WHERE assessment_id = p_assessment_id AND status = 'ISSUED';
  IF p.id IS NULL OR p.crew_profile_id <> uid THEN RETURN jsonb_build_object('ok', false, 'error_code', 'NO_ACTIVE_PAPER'); END IF;
  SELECT * INTO c FROM assessment_checkpoints WHERE assessment_id = p_assessment_id;
  SELECT coalesce(jsonb_agg(jsonb_build_object('paper_item_id', paper_item_id, 'answer', answer, 'answered_at', answered_at)), '[]'::jsonb)
    INTO ans FROM answer_ledger WHERE paper_id = p.id AND answer_state = 'ANSWERED';
  SELECT min(o - 1) INTO nxt FROM jsonb_array_elements(p.items) WITH ORDINALITY t(e, o)
   WHERE NOT EXISTS (SELECT 1 FROM answer_ledger l WHERE l.paper_id = p.id AND l.paper_item_id = e->>'paper_item_id');
  RETURN jsonb_build_object('ok', true, 'paper_id', p.id, 'paper_version', p.paper_version, 'blueprint_version', p.blueprint_version,
    'context', p.context, 'items', p.items, 'answers', ans,
    'next_index', coalesce(nxt, jsonb_array_length(p.items)),
    'checkpoint_index', coalesce(c.current_index, 0), 'elapsed_seconds', coalesce(c.elapsed_seconds, 0),
    'timer_policy', 'PAUSE_ON_TECHNICAL_INTERRUPTION;RESTORE_ELAPSED;MIN_REMAINING_10S',
    'lifecycle_state', c.lifecycle_state, 'interruption_state', c.interruption_state);
END $function$;

CREATE OR REPLACE FUNCTION public.final_scoring_lease(p_assessment_id uuid, p_paper_id uuid, p_is_worker boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE j record;
BEGIN
  INSERT INTO scoring_jobs(assessment_id, payload, status) VALUES (p_assessment_id, jsonb_build_object('assessmentId', p_assessment_id), 'pending')
  ON CONFLICT (assessment_id) DO NOTHING;
  SELECT * INTO j FROM scoring_jobs WHERE assessment_id = p_assessment_id FOR UPDATE;
  IF j.status = 'failed' THEN RETURN jsonb_build_object('state', 'DEAD'); END IF;
  IF j.lease_until IS NOT NULL AND j.lease_until > now() THEN
    RETURN jsonb_build_object('state', 'IN_PROGRESS', 'retry_after', ceil(extract(epoch FROM j.lease_until - now()))); END IF;
  IF NOT p_is_worker AND j.retry_at IS NOT NULL AND j.retry_at > now() THEN
    RETURN jsonb_build_object('state', 'BACKOFF', 'retry_after', ceil(extract(epoch FROM j.retry_at - now()))); END IF;
  UPDATE scoring_jobs SET lease_until = now() + interval '90 seconds' WHERE id = j.id;
  RETURN jsonb_build_object('state', 'LEASED', 'ai_result', CASE WHEN j.ai_result_paper = p_paper_id THEN j.ai_result END);
END $$;

CREATE OR REPLACE FUNCTION public.final_scoring_save_ai(p_assessment_id uuid, p_paper_id uuid, p_dims jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n int;
BEGIN
  UPDATE scoring_jobs SET ai_result = p_dims, ai_result_paper = p_paper_id WHERE assessment_id = p_assessment_id AND status <> 'done';
  GET DIAGNOSTICS n = ROW_COUNT; RETURN n = 1;
END $$;

CREATE OR REPLACE FUNCTION public.final_scoring_release(p_assessment_id uuid, p_error text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE scoring_jobs SET lease_until = NULL,
    last_error = CASE WHEN p_error IS NULL THEN last_error ELSE left(p_error, 200) END,
    final_failures = final_failures + CASE WHEN p_error IS NULL THEN 0 ELSE 1 END,
    retry_at = CASE WHEN p_error IS NULL THEN retry_at ELSE now() + make_interval(mins => least(power(2, final_failures)::int, 30)) END
  WHERE assessment_id = p_assessment_id AND status <> 'done';
END $$;

CREATE OR REPLACE FUNCTION public.answer_scoring_complete(p_job uuid, p_ledger uuid, p_attempt int, p_score numeric, p_result jsonb, p_model text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE j record; n int;
BEGIN
  SELECT * INTO j FROM answer_scoring_jobs WHERE id = p_job FOR UPDATE;
  IF j.id IS NULL OR j.ledger_id <> p_ledger THEN RETURN jsonb_build_object('ok', false, 'error_code', 'NOT_FOUND'); END IF;
  IF j.status <> 'running' OR j.attempts <> p_attempt THEN RETURN jsonb_build_object('ok', false, 'error_code', 'STALE_LEASE'); END IF;
  IF p_score IS NULL OR NOT (p_score BETWEEN 0 AND 10) THEN RETURN jsonb_build_object('ok', false, 'error_code', 'INVALID_SCORE'); END IF;
  UPDATE answer_ledger SET scoring_state = 'EVALUATED', score = p_score, evaluated_at = now(), scoring_attempts = p_attempt,
    last_scoring_error = NULL, result = p_result
   WHERE id = p_ledger AND scoring_state IN ('PENDING','RETRY_REQUIRED');
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 AND NOT EXISTS (SELECT 1 FROM answer_ledger WHERE id = p_ledger AND scoring_state = 'EVALUATED') THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'LEDGER_NOT_UPDATED'); END IF;
  UPDATE answer_scoring_jobs SET status = 'done', last_error = NULL, updated_at = now() WHERE id = p_job;
  INSERT INTO answer_scoring_audit(ledger_id, job_id, attempt, outcome, model) VALUES (p_ledger, p_job, p_attempt, CASE WHEN n = 0 THEN 'ALREADY_EVALUATED' ELSE 'EVALUATED' END, p_model);
  RETURN jsonb_build_object('ok', true, 'preserved_existing', n = 0);
END $$;

CREATE OR REPLACE FUNCTION public.answer_scoring_fail(p_job uuid, p_ledger uuid, p_attempt int, p_error text, p_model text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE j record; dead boolean;
BEGIN
  SELECT * INTO j FROM answer_scoring_jobs WHERE id = p_job FOR UPDATE;
  IF j.id IS NULL OR j.ledger_id <> p_ledger THEN RETURN jsonb_build_object('ok', false, 'error_code', 'NOT_FOUND'); END IF;
  IF j.status <> 'running' OR j.attempts <> p_attempt THEN RETURN jsonb_build_object('ok', false, 'error_code', 'STALE_LEASE'); END IF;
  dead := j.attempts >= j.max_attempts;
  UPDATE answer_ledger SET scoring_state = 'RETRY_REQUIRED', scoring_attempts = p_attempt, last_scoring_error = left(p_error, 200)
   WHERE id = p_ledger AND scoring_state <> 'EVALUATED';
  UPDATE answer_scoring_jobs SET status = CASE WHEN dead THEN 'dead' ELSE 'pending' END, last_error = left(p_error, 200), updated_at = now() WHERE id = p_job;
  INSERT INTO answer_scoring_audit(ledger_id, job_id, attempt, outcome, reason, model) VALUES (p_ledger, p_job, p_attempt, CASE WHEN dead THEN 'DEAD_LETTER' ELSE 'RETRY_SCHEDULED' END, left(p_error, 200), p_model);
  IF dead THEN
    INSERT INTO app_events(event_type, message, severity, metadata)
    VALUES ('answer_scoring_dead_letter', 'Answer scoring exhausted retries — manual review', 'error', jsonb_build_object('ledger_id', p_ledger, 'job_id', p_job, 'assessment_id', j.assessment_id, 'reason', left(p_error, 120)));
  END IF;
  RETURN jsonb_build_object('ok', true, 'dead', dead);
END $$;

CREATE OR REPLACE FUNCTION public.process_answer_scoring_queue()
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_secret text; n_dead int;
BEGIN
  WITH d AS (
    UPDATE answer_scoring_jobs SET status = 'dead', last_error = left(coalesce(last_error, '') || ' | LEASE_EXPIRED_EXHAUSTED', 200), updated_at = now()
     WHERE status = 'running' AND attempts >= max_attempts AND next_attempt_at <= now()
    RETURNING id, ledger_id, assessment_id),
  l AS (UPDATE answer_ledger SET scoring_state = 'RETRY_REQUIRED', last_scoring_error = 'LEASE_EXPIRED_EXHAUSTED'
         WHERE id IN (SELECT ledger_id FROM d) AND scoring_state <> 'EVALUATED' RETURNING id)
  INSERT INTO app_events(event_type, message, severity, metadata)
  SELECT 'answer_scoring_dead_letter', 'Answer scoring worker lease expired on final attempt — manual review', 'error',
         jsonb_build_object('job_id', id, 'ledger_id', ledger_id, 'assessment_id', assessment_id, 'reason', 'LEASE_EXPIRED_EXHAUSTED') FROM d;
  GET DIAGNOSTICS n_dead = ROW_COUNT;
  IF NOT EXISTS (SELECT 1 FROM answer_scoring_jobs WHERE status IN ('pending','running') AND next_attempt_at <= now() AND attempts < max_attempts) THEN
    RETURN CASE WHEN n_dead > 0 THEN 'dead_lettered=' || n_dead ELSE 'idle' END;
  END IF;
  SELECT value INTO v_secret FROM admin_settings WHERE key = 'scoring_worker_secret';
  PERFORM net.http_post(
    url := 'https://luomzexqgcjtcmdlbevo.supabase.co/functions/v1/score-paper-answers',
    headers := jsonb_build_object('Content-Type','application/json','x-worker-secret', coalesce(v_secret,''),
      'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1b216ZXhxZ2NqdGNtZGxiZXZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0OTY4NjEsImV4cCI6MjA4NzA3Mjg2MX0.QJoLu7WC-9h4qoTEXfOMPu1OJTmu8hzBuOGLPOq1IuY'),
    body := '{}'::jsonb, timeout_milliseconds := 55000);
  RETURN 'kicked';
END $function$;

CREATE OR REPLACE FUNCTION public.admin_ops_readiness()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); v_sme int; v_ranks int; v_support text; v_verified boolean; v_backoff int; ctxs jsonb; v_prod_ready int; v_test_ready int; v_bp int; v_prod_ranks int;
BEGIN
  IF uid IS NULL OR NOT is_admin(uid) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;
  SELECT count(*) INTO v_bp FROM assessment_blueprints WHERE status = 'ACTIVE' AND NOT is_test;
  SELECT count(*) INTO v_sme FROM assessment_items WHERE approval_status = 'SME_APPROVED' AND is_active AND source_type NOT IN ('TEST_FIXTURE','AI_DRAFT','LEGACY_QUESTION_BANK');
  SELECT count(DISTINCT canonical_rank) INTO v_ranks FROM rank_taxonomy WHERE canonical_rank IS NOT NULL;
  SELECT value INTO v_support FROM admin_settings WHERE key = 'support_contact_email';
  SELECT coalesce(lower(value) = 'true', false) INTO v_verified FROM admin_settings WHERE key = 'support_contact_verified';
  SELECT count(*) INTO v_backoff FROM admin_settings WHERE key LIKE 'smc_backoff:%'
    AND coalesce((CASE WHEN value ~ '^\s*\{' THEN value::jsonb->>'until' END)::bigint, 0) > extract(epoch FROM now())*1000;
  SELECT coalesce(jsonb_agg(jsonb_build_object('canonical_rank', b.canonical_rank, 'department', b.department, 'level', b.level,
           'vessel_context', b.vessel_context, 'is_test', b.is_test, 'blueprint_version', b.blueprint_version,
           'coverage_ok', (cv->>'ok')::boolean, 'shortfalls', cv->'shortfalls') ORDER BY b.is_test, b.canonical_rank), '[]'::jsonb),
         count(*) FILTER (WHERE NOT b.is_test AND (cv->>'ok')::boolean), count(*) FILTER (WHERE b.is_test AND (cv->>'ok')::boolean),
         count(DISTINCT b.canonical_rank) FILTER (WHERE NOT b.is_test AND (cv->>'ok')::boolean)
    INTO ctxs, v_prod_ready, v_test_ready, v_prod_ranks
    FROM assessment_blueprints b CROSS JOIN LATERAL blueprint_coverage_for(b.id, b.canonical_rank) cv
   WHERE b.status = 'ACTIVE';
  RETURN jsonb_build_object(
    'canonical_rank_count', v_ranks,
    'production_active_blueprints', v_bp,
    'production_ready_contexts', v_prod_ready,
    'production_ranks_without_ready_paper', v_ranks - v_prod_ranks,
    'test_ready_contexts', v_test_ready,
    'context_readiness', ctxs,
    'sme_approved_active_items', v_sme,
    'test_blueprints', (SELECT count(*) FROM assessment_blueprints WHERE status='ACTIVE' AND is_test),
    'legacy_review_items', (SELECT count(*) FROM assessment_items WHERE approval_status = 'LEGACY_REVIEW_REQUIRED'),
    'test_only_items', (SELECT count(*) FROM assessment_items WHERE approval_status = 'TEST_ONLY'),
    'scoring_jobs_pending', (SELECT count(*) FROM answer_scoring_jobs WHERE status IN ('pending','running') AND NOT (status = 'running' AND attempts >= max_attempts AND next_attempt_at <= now())),
    'scoring_jobs_dead', (SELECT count(*) FROM answer_scoring_jobs WHERE status = 'dead' OR (status = 'running' AND attempts >= max_attempts AND next_attempt_at <= now())),
    'finalization_failed', (SELECT count(*) FROM scoring_jobs WHERE status = 'failed'),
    'answers_retry_required', (SELECT count(*) FROM answer_ledger WHERE scoring_state = 'RETRY_REQUIRED'),
    'answers_manual_review', (SELECT count(*) FROM answer_ledger l WHERE scoring_state = 'RETRY_REQUIRED' AND EXISTS (SELECT 1 FROM answer_scoring_jobs s WHERE s.ledger_id = l.id AND s.status = 'dead')),
    'open_recovery_cases', (SELECT count(*) FROM recovery_cases WHERE status IN ('OPEN','HEALTH_BLOCKED','RECOVERABLE','NOTIFIED','NOTIFY_FAILED')),
    'health_blocked_cases', (SELECT count(*) FROM recovery_cases WHERE status = 'HEALTH_BLOCKED'),
    'open_start_incidents', (SELECT count(*) FROM assessment_start_incidents WHERE status = 'OPEN'),
    'outbox_pending', (SELECT count(*) FROM recovery_outbox WHERE status IN ('PENDING','LEASED','FAILED')),
    'outbox_dead', (SELECT count(*) FROM recovery_outbox WHERE status = 'DEAD'),
    'email_delivery_tracking', CASE WHEN EXISTS (SELECT 1 FROM admin_settings WHERE key = 'email_delivery_webhook_configured' AND value = 'true') THEN 'CONFIGURED' ELSE 'NOT_CONFIGURED' END,
    'health_recheck_schedule', 'Checked inside the existing scoring job run (about every 15 min); blocked cases rechecked every ' || coalesce((recovery_policy()->>'recheck_minutes'), '30') || ' min',
    'support_contact_configured', v_support IS NOT NULL AND v_support <> '',
    'support_contact_verified', coalesce(v_verified,false) AND v_support IS NOT NULL AND v_support <> '',
    'recovery_email_last_error', (SELECT e.detail->>'error' FROM recovery_events e WHERE e.event IN ('EMAIL_FAILED','EMAIL_RETRY_SCHEDULED','NOTIFY_FAILED','SEND_FAILED') ORDER BY e.created_at DESC LIMIT 1),
    'active_backoffs', v_backoff,
    'production_blocked', v_prod_ready = 0,
    'checked_at', now());
END $function$;

REVOKE ALL ON FUNCTION public._start_incident_upsert(uuid,uuid,text,text,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recovery_claim_due(uuid,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recovery_mark_sent(uuid,boolean,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recovery_outbox_lease(uuid,int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recovery_outbox_result(uuid,int,boolean,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.process_recovery_queue() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.process_answer_scoring_queue() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.final_scoring_lease(uuid,uuid,boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.final_scoring_save_ai(uuid,uuid,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.final_scoring_release(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.answer_scoring_complete(uuid,uuid,int,numeric,jsonb,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.answer_scoring_fail(uuid,uuid,int,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_assessment_commit(uuid,uuid,uuid,jsonb,jsonb,jsonb,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_assessment_prepare(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.blueprint_coverage_for(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.blueprint_coverage(jsonb,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._start_incident_upsert(uuid,uuid,text,text,text,text,text), public.recovery_claim_due(uuid,integer),
  public.recovery_mark_sent(uuid,boolean,text), public.recovery_outbox_lease(uuid,int), public.recovery_outbox_result(uuid,int,boolean,text,text),
  public.process_recovery_queue(), public.process_answer_scoring_queue(), public.final_scoring_lease(uuid,uuid,boolean),
  public.final_scoring_save_ai(uuid,uuid,jsonb), public.final_scoring_release(uuid,text),
  public.answer_scoring_complete(uuid,uuid,int,numeric,jsonb,text), public.answer_scoring_fail(uuid,uuid,int,text,text),
  public.finalize_assessment_commit(uuid,uuid,uuid,jsonb,jsonb,jsonb,text), public.finalize_assessment_prepare(uuid,uuid),
  public.blueprint_coverage_for(uuid,text), public.blueprint_coverage(jsonb,boolean) TO service_role;
REVOKE ALL ON FUNCTION public.record_start_incident(uuid,text,text,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirm_resume(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_start_incident(uuid,text,text,text,text,text), public.confirm_resume(uuid,uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
