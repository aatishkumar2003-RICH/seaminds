CREATE TABLE public.assessment_checkpoints (
  assessment_id uuid PRIMARY KEY REFERENCES public.smc_assessments(id) ON DELETE CASCADE,
  crew_profile_id uuid NOT NULL,
  paper_id uuid,
  lifecycle_state text NOT NULL DEFAULT 'PREPARING' CHECK (lifecycle_state IN ('STARTED','PREPARING','READY','IN_PROGRESS','INTERRUPTED','COMPLETED','SCORED')),
  interruption_state text CHECK (interruption_state IN ('USER_PAUSED','CONNECTIVITY_INTERRUPTED','SYSTEM_INTERRUPTED','UNATTRIBUTED_INTERRUPTION')),
  interruption_reason text,
  interrupted_at timestamptz,
  delivered_at timestamptz,
  current_index int NOT NULL DEFAULT 0,
  elapsed_seconds int NOT NULL DEFAULT 0,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.assessment_checkpoints TO authenticated;
GRANT ALL ON public.assessment_checkpoints TO service_role;
ALTER TABLE public.assessment_checkpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own checkpoint read" ON public.assessment_checkpoints FOR SELECT TO authenticated
  USING (crew_profile_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TABLE public.assessment_state_log (
  id bigserial PRIMARY KEY,
  assessment_id uuid NOT NULL,
  paper_id uuid,
  actor uuid,
  event text NOT NULL,
  from_state text,
  to_state text,
  reason text,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.assessment_state_log TO authenticated;
GRANT ALL ON public.assessment_state_log TO service_role;
ALTER TABLE public.assessment_state_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read state log" ON public.assessment_state_log FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE TABLE public.paper_supersessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL,
  old_paper_id uuid NOT NULL UNIQUE REFERENCES public.issued_papers(id),
  new_paper_id uuid REFERENCES public.issued_papers(id),
  disposition text NOT NULL CHECK (disposition IN ('NEVER_DELIVERED','SEEN_UNANSWERED','ANSWERED')),
  answered_count int NOT NULL DEFAULT 0,
  recovery_policy text NOT NULL CHECK (recovery_policy IN ('FRESH_PAPER','RETAIN_ANSWERS_FOR_REVIEW','VOID_PRIOR_ANSWERS_AUDITED')),
  reason text NOT NULL,
  authorized_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.paper_supersessions TO authenticated;
GRANT ALL ON public.paper_supersessions TO service_role;
ALTER TABLE public.paper_supersessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read supersessions" ON public.paper_supersessions FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.protect_supersession() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'supersession history is immutable'; END IF;
  IF NEW.old_paper_id IS DISTINCT FROM OLD.old_paper_id OR NEW.disposition IS DISTINCT FROM OLD.disposition
     OR NEW.recovery_policy IS DISTINCT FROM OLD.recovery_policy OR NEW.reason IS DISTINCT FROM OLD.reason
     OR NEW.authorized_by IS DISTINCT FROM OLD.authorized_by OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR (OLD.new_paper_id IS NOT NULL AND NEW.new_paper_id IS DISTINCT FROM OLD.new_paper_id) THEN
    RAISE EXCEPTION 'supersession history is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_protect_supersession BEFORE UPDATE OR DELETE ON public.paper_supersessions FOR EACH ROW EXECUTE FUNCTION public.protect_supersession();

-- Candidate checkpoint: deterministic progress, clears any interruption (= resume)
CREATE OR REPLACE FUNCTION public.save_checkpoint(p_assessment_id uuid, p_current_index int, p_elapsed_seconds int DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); p record; c record;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error_code', 'AUTH_REQUIRED'); END IF;
  SELECT id, crew_profile_id, jsonb_array_length(items) n INTO p FROM issued_papers WHERE assessment_id = p_assessment_id AND status = 'ISSUED';
  IF p.id IS NULL OR p.crew_profile_id <> uid THEN RETURN jsonb_build_object('ok', false, 'error_code', 'NOT_FOUND'); END IF;
  SELECT * INTO c FROM assessment_checkpoints WHERE assessment_id = p_assessment_id FOR UPDATE;
  IF c.interruption_state IS NOT NULL THEN
    INSERT INTO assessment_state_log(assessment_id, paper_id, actor, event, from_state, to_state, reason, source)
    VALUES (p_assessment_id, p.id, uid, 'RESUMED', c.interruption_state, 'IN_PROGRESS', c.interruption_reason, 'candidate');
  END IF;
  UPDATE assessment_checkpoints SET paper_id = p.id, lifecycle_state = 'IN_PROGRESS', interruption_state = NULL, interruption_reason = NULL, interrupted_at = NULL,
    current_index = GREATEST(current_index, LEAST(GREATEST(coalesce(p_current_index, 0), 0), p.n)),
    elapsed_seconds = GREATEST(elapsed_seconds, coalesce(p_elapsed_seconds, elapsed_seconds)),
    last_seen_at = now(), updated_at = now()
  WHERE assessment_id = p_assessment_id;
  RETURN jsonb_build_object('ok', true);
END $$;

-- Candidate-observed interruption. Server never trusts client to claim more than it can observe.
CREATE OR REPLACE FUNCTION public.record_interruption(p_assessment_id uuid, p_kind text, p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); c record; k text := upper(coalesce(p_kind, '')); r text := left(coalesce(p_reason, ''), 80);
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error_code', 'AUTH_REQUIRED'); END IF;
  SELECT * INTO c FROM assessment_checkpoints WHERE assessment_id = p_assessment_id FOR UPDATE;
  IF c.assessment_id IS NULL OR c.crew_profile_id <> uid THEN RETURN jsonb_build_object('ok', false, 'error_code', 'NOT_FOUND'); END IF;
  IF c.lifecycle_state IN ('COMPLETED','SCORED') THEN RETURN jsonb_build_object('ok', true, 'ignored', 'finished'); END IF;
  IF k NOT IN ('USER_PAUSED','CONNECTIVITY_INTERRUPTED','SYSTEM_INTERRUPTED','UNATTRIBUTED_INTERRUPTION') THEN k := 'UNATTRIBUTED_INTERRUPTION'; END IF;
  -- SYSTEM attribution from the browser only with concrete server-error evidence; else neutral.
  IF k = 'SYSTEM_INTERRUPTED' AND r NOT IN ('http_5xx','rpc_server_error','edge_function_error') THEN k := 'UNATTRIBUTED_INTERRUPTION'; END IF;
  -- Don't let a later voluntary pause relabel an already-recorded system/connectivity fault.
  IF c.interruption_state IN ('SYSTEM_INTERRUPTED','CONNECTIVITY_INTERRUPTED') AND k = 'USER_PAUSED' THEN RETURN jsonb_build_object('ok', true, 'state', c.interruption_state); END IF;
  UPDATE assessment_checkpoints SET lifecycle_state = 'INTERRUPTED', interruption_state = k, interruption_reason = nullif(r, ''),
    interrupted_at = coalesce(interrupted_at, now()), updated_at = now() WHERE assessment_id = p_assessment_id;
  INSERT INTO assessment_state_log(assessment_id, paper_id, actor, event, from_state, to_state, reason, source)
  VALUES (p_assessment_id, c.paper_id, uid, 'INTERRUPTED', coalesce(c.interruption_state, c.lifecycle_state), k, nullif(r, ''), 'candidate_observed');
  RETURN jsonb_build_object('ok', true, 'state', k);
END $$;

-- Server-side system interruption (worker/service only)
CREATE OR REPLACE FUNCTION public.record_system_interruption(p_assessment_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE assessment_checkpoints SET lifecycle_state = 'INTERRUPTED', interruption_state = 'SYSTEM_INTERRUPTED', interruption_reason = left(p_reason, 80),
    interrupted_at = coalesce(interrupted_at, now()), updated_at = now()
  WHERE assessment_id = p_assessment_id AND lifecycle_state NOT IN ('COMPLETED','SCORED');
  INSERT INTO assessment_state_log(assessment_id, event, to_state, reason, source) VALUES (p_assessment_id, 'INTERRUPTED', 'SYSTEM_INTERRUPTED', left(p_reason, 80), 'server');
END $$;
REVOKE ALL ON FUNCTION public.record_system_interruption(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_system_interruption(uuid, text) TO service_role;

-- Resume: same frozen paper + own prior answers + checkpoint. No keys, no correctness.
CREATE OR REPLACE FUNCTION public.get_resume_state(p_assessment_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); p record; c record; ans jsonb; nxt int;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error_code', 'AUTH_REQUIRED'); END IF;
  SELECT * INTO p FROM issued_papers WHERE assessment_id = p_assessment_id AND status = 'ISSUED';
  IF p.id IS NULL OR p.crew_profile_id <> uid THEN RETURN jsonb_build_object('ok', false, 'error_code', 'NO_ACTIVE_PAPER'); END IF;
  SELECT * INTO c FROM assessment_checkpoints WHERE assessment_id = p_assessment_id;
  SELECT coalesce(jsonb_agg(jsonb_build_object('paper_item_id', paper_item_id, 'answer', answer, 'answered_at', answered_at)), '[]'::jsonb)
    INTO ans FROM answer_ledger WHERE paper_id = p.id AND answer_state = 'ANSWERED';
  SELECT min(o - 1) INTO nxt FROM jsonb_array_elements(p.items) WITH ORDINALITY t(e, o)
   WHERE NOT EXISTS (SELECT 1 FROM answer_ledger l WHERE l.paper_id = p.id AND l.paper_item_id = e->>'paper_item_id' AND l.answer_state = 'ANSWERED');
  RETURN jsonb_build_object('ok', true, 'paper_id', p.id, 'paper_version', p.paper_version, 'blueprint_version', p.blueprint_version,
    'context', p.context, 'items', p.items, 'answers', ans,
    'next_index', coalesce(nxt, jsonb_array_length(p.items)),
    'checkpoint_index', coalesce(c.current_index, 0), 'elapsed_seconds', coalesce(c.elapsed_seconds, 0),
    'lifecycle_state', c.lifecycle_state, 'interruption_state', c.interruption_state);
END $$;

-- Controlled reissue (admin only). v1 kept, marked SUPERSEDED_SYSTEM_ERROR, linked; answers never deleted.
CREATE OR REPLACE FUNCTION public.admin_reissue_paper(p_assessment_id uuid, p_reason text, p_policy text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); p record; c record; n int; disp text; pol text := upper(coalesce(p_policy, ''));
BEGIN
  IF uid IS NULL OR NOT is_admin(uid) THEN RETURN jsonb_build_object('ok', false, 'error_code', 'FORBIDDEN'); END IF;
  IF coalesce(length(trim(p_reason)), 0) < 10 THEN RETURN jsonb_build_object('ok', false, 'error_code', 'REASON_REQUIRED'); END IF;
  SELECT * INTO p FROM issued_papers WHERE assessment_id = p_assessment_id AND status = 'ISSUED' FOR UPDATE;
  IF p.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error_code', 'NO_ACTIVE_PAPER'); END IF;
  SELECT * INTO c FROM assessment_checkpoints WHERE assessment_id = p_assessment_id;
  SELECT count(*) INTO n FROM answer_ledger WHERE paper_id = p.id AND answer_state = 'ANSWERED';
  disp := CASE WHEN n > 0 THEN 'ANSWERED' WHEN c.delivered_at IS NOT NULL THEN 'SEEN_UNANSWERED' ELSE 'NEVER_DELIVERED' END;
  IF disp = 'ANSWERED' AND pol NOT IN ('RETAIN_ANSWERS_FOR_REVIEW','VOID_PRIOR_ANSWERS_AUDITED') THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'REISSUE_POLICY_REQUIRED', 'answered_count', n,
      'allowed_policies', jsonb_build_array('RETAIN_ANSWERS_FOR_REVIEW','VOID_PRIOR_ANSWERS_AUDITED'));
  END IF;
  IF disp <> 'ANSWERED' THEN pol := 'FRESH_PAPER'; END IF;
  UPDATE issued_papers SET status = 'SUPERSEDED_SYSTEM_ERROR' WHERE id = p.id;
  INSERT INTO paper_supersessions(assessment_id, old_paper_id, disposition, answered_count, recovery_policy, reason, authorized_by)
  VALUES (p_assessment_id, p.id, disp, n, pol, trim(p_reason), uid);
  UPDATE assessment_checkpoints SET paper_id = NULL, lifecycle_state = 'PREPARING', current_index = 0, elapsed_seconds = 0, delivered_at = NULL, updated_at = now()
   WHERE assessment_id = p_assessment_id;
  INSERT INTO assessment_state_log(assessment_id, paper_id, actor, event, from_state, to_state, reason, source)
  VALUES (p_assessment_id, p.id, uid, 'PAPER_SUPERSEDED', 'ISSUED', 'SUPERSEDED_SYSTEM_ERROR', disp || '/' || pol || ': ' || left(trim(p_reason), 200), 'admin');
  RETURN jsonb_build_object('ok', true, 'superseded_paper_id', p.id, 'disposition', disp, 'answered_count', n, 'recovery_policy', pol);
END $$;

-- issue_paper: version-aware (v2 after supersession), records delivery + links supersession
CREATE OR REPLACE FUNCTION public.issue_paper(p_assessment_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
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
  -- A new version is only allowed when every earlier paper was formally superseded (or none exist).
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
        disp := disp || jsonb_build_object('paper_item_id', pi, 'type', 'mcq', 'domain', it.domain, 'question', it.prompt->>'question', 'options', opts);
        keys := keys || jsonb_build_object('pi', pi, 'item', it.id, 'v', it.question_version,
          'key', jsonb_build_object('correct_index', newc, 'correct_letter', chr(65 + newc), 'explanation', it.answer_key->>'explanation', 'regulation', it.answer_key->>'regulation', 'option_order', to_jsonb(perm)));
      ELSE
        disp := disp || jsonb_strip_nulls(jsonb_build_object('paper_item_id', pi, 'type', it.question_type, 'domain', it.domain, 'question', it.prompt->>'question',
          'situation', it.prompt->>'situation', 'category', it.prompt->>'category', 'prompt_text', it.prompt->>'prompt_text', 'time_seconds', (it.prompt->>'time_seconds')::int));
        keys := keys || jsonb_build_object('pi', pi, 'item', it.id, 'v', it.question_version, 'key', it.answer_key);
      END IF;
    END LOOP;
    IF got < need THEN shortfalls := shortfalls || jsonb_build_object('requirement', req, 'available', got, 'required', need); END IF;
  END LOOP;

  IF jsonb_array_length(shortfalls) > 0 OR k = 0 THEN
    INSERT INTO app_events(event_type, message, severity, user_id, metadata)
    VALUES ('blueprint_incomplete', 'inventory does not satisfy blueprint', 'warning', uid,
            jsonb_build_object('assessment_id', p_assessment_id, 'blueprint_id', bp.id, 'shortfalls', shortfalls));
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

  RETURN jsonb_build_object('ok', true, 'paper_id', pid, 'paper_version', ver, 'blueprint_version', bp.blueprint_version,
    'is_test', bp.is_test, 'context', ctx, 'items', disp, 'issued_at', now());
END $function$;

GRANT EXECUTE ON FUNCTION public.save_checkpoint(uuid, int, int), public.record_interruption(uuid, text, text), public.get_resume_state(uuid), public.admin_reissue_paper(uuid, text, text) TO authenticated;
NOTIFY pgrst, 'reload schema';