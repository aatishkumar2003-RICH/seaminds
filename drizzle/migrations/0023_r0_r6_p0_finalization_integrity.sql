
-- 1) Explicit timeout disposition in the write-first ledger (never inferred from a missing row)
CREATE OR REPLACE FUNCTION public.submit_paper_answer(p_assessment_id uuid, p_paper_item_id text, p_answer text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); p record; itm jsonb; led record; k jsonb; sel int; ok boolean; ip text; ans text; timed_out boolean;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error_code', 'AUTH_REQUIRED'); END IF;
  SELECT id, crew_profile_id, items INTO p FROM issued_papers WHERE assessment_id = p_assessment_id AND status = 'ISSUED';
  IF p.id IS NULL OR p.crew_profile_id <> uid THEN RETURN jsonb_build_object('ok', false, 'error_code', 'NOT_FOUND'); END IF;
  SELECT e INTO itm FROM jsonb_array_elements(p.items) e WHERE e->>'paper_item_id' = p_paper_item_id;
  IF itm IS NULL THEN RETURN jsonb_build_object('ok', false, 'error_code', 'UNKNOWN_ITEM'); END IF;
  ans := left(coalesce(p_answer, ''), 4000);
  timed_out := (itm->>'type' <> 'mcq' AND btrim(ans) IN ('', '__TIMED_OUT__', '[No answer — time expired]'))
            OR (itm->>'type' = 'mcq' AND btrim(ans) = '-1');

  SELECT * INTO led FROM answer_ledger WHERE paper_id = p.id AND paper_item_id = p_paper_item_id;
  IF led.id IS NULL THEN
    BEGIN ip := split_part(coalesce(current_setting('request.headers', true)::jsonb->>'x-forwarded-for', ''), ',', 1); EXCEPTION WHEN others THEN ip := NULL; END;
    IF NOT candidate_rate_ok(uid, p_assessment_id, 'submit_answer', 200, interval '10 minutes', nullif(ip, '')) THEN
      RETURN jsonb_build_object('ok', false, 'error_code', 'RATE_LIMITED');
    END IF;
    IF timed_out AND itm->>'type' <> 'mcq' THEN
      INSERT INTO answer_ledger(paper_id, paper_item_id, assessment_id, crew_profile_id, item_type, answer, answer_state, scoring_state, score, evaluated_at, result, submit_ip)
      VALUES (p.id, p_paper_item_id, p_assessment_id, uid, itm->>'type', NULL, 'UNANSWERED', 'NOT_REQUIRED', 0, now(),
              jsonb_build_object('method','explicit_disposition','disposition','TIMED_OUT'), nullif(ip, ''))
      ON CONFLICT (paper_id, paper_item_id) DO NOTHING;
    ELSE
      INSERT INTO answer_ledger(paper_id, paper_item_id, assessment_id, crew_profile_id, item_type, answer, scoring_state, submit_ip)
      VALUES (p.id, p_paper_item_id, p_assessment_id, uid, itm->>'type', ans, 'PENDING', nullif(ip, ''))
      ON CONFLICT (paper_id, paper_item_id) DO NOTHING;
    END IF;
    SELECT * INTO led FROM answer_ledger WHERE paper_id = p.id AND paper_item_id = p_paper_item_id;

    IF led.scoring_state = 'PENDING' AND led.item_type = 'mcq' THEN
      SELECT answer_key INTO k FROM issued_paper_keys WHERE paper_id = p.id AND paper_item_id = p_paper_item_id;
      sel := CASE WHEN led.answer ~ '^-?\d+$' THEN led.answer::int ELSE -1 END;
      ok := k IS NOT NULL AND sel = (k->>'correct_index')::int;
      UPDATE answer_ledger SET scoring_state = 'EVALUATED', is_correct = ok, score = CASE WHEN ok THEN 10 ELSE 0 END,
             evaluated_at = now(),
             result = CASE WHEN sel = -1 THEN jsonb_build_object('method','deterministic_key','disposition','TIMED_OUT')
                           ELSE jsonb_build_object('method','deterministic_key') END
       WHERE id = led.id;
      INSERT INTO answer_scoring_audit(ledger_id, outcome, reason, model) VALUES (led.id, 'EVALUATED', 'deterministic mcq', 'none');
    ELSIF led.scoring_state = 'PENDING' THEN
      INSERT INTO answer_scoring_jobs(ledger_id, assessment_id) VALUES (led.id, p_assessment_id) ON CONFLICT (ledger_id) DO NOTHING;
    END IF;
    SELECT * INTO led FROM answer_ledger WHERE id = led.id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'persisted', true, 'paper_item_id', p_paper_item_id,
    'answer_state', led.answer_state, 'scoring_state', led.scoring_state, 'answered_at', led.answered_at,
    'duplicate', led.answer IS DISTINCT FROM ans OR led.answered_at < now() - interval '1 second',
    'original_answer_kept', led.answer IS DISTINCT FROM ans,
    'is_correct', CASE WHEN led.item_type = 'mcq' THEN led.is_correct END,
    'score', CASE WHEN led.item_type = 'mcq' THEN led.score END);
END $function$;

-- 2) Server-authoritative finalization: prepare (validate + build transcript from ledger)
CREATE OR REPLACE FUNCTION public.finalize_assessment_prepare(p_assessment_id uuid, p_caller uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE a record; p record; prog record; inv record; v_mode text := 'self';
  n_missing int; n_pending int; n_dead int; n_invalid int; v_transcript jsonb; v_flags jsonb; v_name text;
BEGIN
  SELECT * INTO a FROM smc_assessments WHERE id = p_assessment_id;
  IF a.id IS NULL THEN RETURN jsonb_build_object('ok',false,'error_code','NOT_FOUND'); END IF;
  IF p_caller IS NOT NULL AND a.crew_profile_id IS DISTINCT FROM p_caller THEN
    RETURN jsonb_build_object('ok',false,'error_code','FORBIDDEN'); END IF;
  IF a.status = 'completed' AND a.overall_score IS NOT NULL THEN
    RETURN jsonb_build_object('ok',true,'already_completed',true,'certificate_id',a.certificate_id,
      'scores', jsonb_build_object('technical',a.technical_score,'judgment',a.judgment_score,'english',a.english_score,
        'behaviour',a.behavioural_score,'overall',a.overall_score,'band',a.score_band,'recommendation',a.recommendation,
        'scoring_version',a.scoring_version,'level_profile',a.level_profile));
  END IF;
  IF a.preflight_confirmed_at IS NULL OR coalesce(a.preflight_context->>'canonical_rank','') = '' THEN
    RETURN jsonb_build_object('ok',false,'error_code','PREFLIGHT_REQUIRED'); END IF;

  SELECT * INTO p FROM issued_papers WHERE assessment_id = p_assessment_id AND status IN ('ISSUED','COMPLETED')
   ORDER BY paper_version DESC LIMIT 1;
  IF p.id IS NULL THEN RETURN jsonb_build_object('ok',false,'error_code','PAPER_REQUIRED'); END IF;
  IF p.crew_profile_id IS DISTINCT FROM a.crew_profile_id
     OR coalesce(p.context->>'canonical_rank','') <> (a.preflight_context->>'canonical_rank') THEN
    RETURN jsonb_build_object('ok',false,'error_code','CONTEXT_MISMATCH'); END IF;

  SELECT * INTO prog FROM interview_progress WHERE assessment_id = p_assessment_id LIMIT 1;
  IF prog.id IS NOT NULL THEN
    v_mode := 'interview';
    SELECT * INTO inv FROM interview_invites WHERE id = prog.invite_id;
    IF prog.crew_id IS DISTINCT FROM a.crew_profile_id OR inv.id IS NULL
       OR inv.crew_profile_id IS DISTINCT FROM a.crew_profile_id OR inv.campaign_id IS DISTINCT FROM prog.campaign_id THEN
      RETURN jsonb_build_object('ok',false,'error_code','CONTEXT_MISMATCH'); END IF;
  END IF;

  WITH it AS (SELECT e FROM jsonb_array_elements(p.items) e),
  j AS (SELECT it.e, l.* FROM it LEFT JOIN answer_ledger l ON l.paper_id = p.id AND l.paper_item_id = it.e->>'paper_item_id')
  SELECT count(*) FILTER (WHERE j.id IS NULL),
         count(*) FILTER (WHERE j.scoring_state IN ('PENDING','RETRY_REQUIRED') AND NOT EXISTS (
            SELECT 1 FROM answer_scoring_jobs s WHERE s.ledger_id = j.id AND s.attempts >= s.max_attempts)),
         count(*) FILTER (WHERE j.scoring_state IN ('PENDING','RETRY_REQUIRED') AND EXISTS (
            SELECT 1 FROM answer_scoring_jobs s WHERE s.ledger_id = j.id AND s.attempts >= s.max_attempts)),
         count(*) FILTER (WHERE (j.scoring_state = 'EVALUATED' AND (j.score IS NULL OR j.score < 0 OR j.score > 10))
            OR (j.scoring_state = 'NOT_REQUIRED' AND (j.answer_state <> 'UNANSWERED' OR coalesce(j.result->>'disposition','') = '' OR coalesce(j.score,0) <> 0)))
    INTO n_missing, n_pending, n_dead, n_invalid FROM j;
  IF n_missing > 0 THEN RETURN jsonb_build_object('ok',false,'error_code','ANSWERS_INCOMPLETE','missing',n_missing); END IF;
  IF n_invalid > 0 THEN RETURN jsonb_build_object('ok',false,'error_code','LEDGER_INVALID','invalid',n_invalid); END IF;
  IF n_dead > 0 THEN RETURN jsonb_build_object('ok',false,'error_code','SCORING_MANUAL_REVIEW','dead',n_dead); END IF;
  IF n_pending > 0 THEN RETURN jsonb_build_object('ok',false,'error_code','SCORING_PENDING','pending',n_pending); END IF;

  -- Wellbeing items (if any) are never part of an employment score
  SELECT jsonb_agg(jsonb_build_object('question', e->>'question', 'answer', coalesce(l.answer,''),
           'score', coalesce(l.score,0), 'redFlag', coalesce((l.result->>'red_flag')::boolean,false),
           'redFlagCategory', l.result->>'red_flag_category', 'disposition', l.result->>'disposition',
           'type', e->>'type', 'domain', e->>'domain', 'level', e->>'level', 'weight', e->'weight') ORDER BY ord),
         coalesce(jsonb_agg(DISTINCT l.result->>'red_flag_category') FILTER (WHERE l.result->>'red_flag_category' IS NOT NULL), '[]'::jsonb)
    INTO v_transcript, v_flags
    FROM jsonb_array_elements(p.items) WITH ORDINALITY x(e, ord)
    JOIN answer_ledger l ON l.paper_id = p.id AND l.paper_item_id = e->>'paper_item_id'
   WHERE coalesce(e->>'domain','') !~* '(wellbeing|wellness|mental)';

  SELECT first_name INTO v_name FROM crew_profiles WHERE id = a.crew_profile_id;
  RETURN jsonb_build_object('ok',true,'already_completed',false,'mode',v_mode,'paper_id',p.id,
    'crew_profile_id',a.crew_profile_id,'rank',a.preflight_context->>'canonical_rank',
    'vessel_context',coalesce(p.context->>'vessel_context',a.preflight_context->>'vessel_context'),
    'level',a.preflight_context->>'level','first_name',coalesce(v_name,'Seafarer'),
    'transcript',coalesce(v_transcript,'[]'::jsonb),'red_flags',v_flags);
END $function$;

-- 3) Atomic, idempotent commit (row lock; one certificate; paper + job + log coordinated)
CREATE OR REPLACE FUNCTION public.finalize_assessment_commit(p_assessment_id uuid, p_paper_id uuid, p_caller uuid,
  p_scores jsonb, p_level_profile jsonb, p_red_flags jsonb, p_certificate_id text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE a record; v_ok boolean; k text; n int;
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
    v_ok := jsonb_typeof(p_scores->k) = 'number' AND (p_scores->>k)::numeric BETWEEN 0 AND 5;
    IF NOT v_ok THEN RETURN jsonb_build_object('ok',false,'error_code','INVALID_SCORES','field',k); END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM issued_papers WHERE id = p_paper_id AND assessment_id = p_assessment_id
                 AND crew_profile_id = a.crew_profile_id AND status IN ('ISSUED','COMPLETED')) THEN
    RETURN jsonb_build_object('ok',false,'error_code','PAPER_REQUIRED'); END IF;

  UPDATE smc_assessments SET
    technical_score = (p_scores->>'technical')::numeric, judgment_score = (p_scores->>'judgment')::numeric,
    english_score = (p_scores->>'english')::numeric, behavioural_score = (p_scores->>'behaviour')::numeric,
    overall_score = (p_scores->>'overall')::numeric, level_profile = p_level_profile,
    score_band = p_scores->>'band', recommendation = p_scores->>'recommendation', scoring_version = 'v1.1',
    certificate_id = p_certificate_id,
    dimension_scores = jsonb_build_object('technical',(p_scores->>'technical')::numeric,'judgment',(p_scores->>'judgment')::numeric,
      'maritime_english',(p_scores->>'english')::numeric,'professional_behaviour',(p_scores->>'behaviour')::numeric),
    red_flags = coalesce(p_red_flags,'[]'::jsonb), status = 'completed', completed_at = now()
  WHERE id = p_assessment_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'PERSIST_FAILED'; END IF;
  UPDATE issued_papers SET status = 'COMPLETED' WHERE id = p_paper_id AND status = 'ISSUED';
  UPDATE scoring_jobs SET status = 'done', completed_at = now() WHERE assessment_id = p_assessment_id AND status <> 'done';
  INSERT INTO assessment_state_log(assessment_id, paper_id, actor, event, from_state, to_state, reason, source)
  VALUES (p_assessment_id, p_paper_id, p_caller, 'FINALIZED', a.status, 'completed', 'server finalization', 'score-assessment');
  RETURN jsonb_build_object('ok',true,'already_completed',false,'certificate_id',p_certificate_id);
END $function$;

REVOKE ALL ON FUNCTION public.finalize_assessment_prepare(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_assessment_commit(uuid, uuid, uuid, jsonb, jsonb, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_assessment_prepare(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_assessment_commit(uuid, uuid, uuid, jsonb, jsonb, jsonb, text) TO service_role;

-- 4) Company interview completion: strict ownership + binding + confirmed scored result
CREATE OR REPLACE FUNCTION public.complete_interview(p_invite_id uuid, p_assessment_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); inv record; a record; n int;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok',false,'error_code','AUTH_REQUIRED'); END IF;
  SELECT * INTO inv FROM interview_invites WHERE id = p_invite_id AND crew_profile_id = uid FOR UPDATE;
  IF inv.id IS NULL THEN RETURN jsonb_build_object('ok',false,'error_code','NOT_FOUND'); END IF;
  IF inv.status = 'completed' THEN
    IF inv.assessment_id = p_assessment_id THEN
      RETURN jsonb_build_object('ok',true,'already_completed',true,'score',inv.overall_score); END IF;
    RETURN jsonb_build_object('ok',false,'error_code','ALREADY_COMPLETED');
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
REVOKE ALL ON FUNCTION public.complete_interview(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_interview(uuid, uuid) TO authenticated, service_role;

-- 5) Privileged dispatch / background scanners: background only
REVOKE ALL ON FUNCTION public.process_scoring_jobs() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ai_spend_sentinel() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_monthly_credits() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.marketing_pack_daily() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.outreach_digest_scan() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.placement_release_scan() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_scoring_jobs() TO service_role;
GRANT EXECUTE ON FUNCTION public.ai_spend_sentinel() TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_monthly_credits() TO service_role;
GRANT EXECUTE ON FUNCTION public.marketing_pack_daily() TO service_role;
GRANT EXECUTE ON FUNCTION public.outreach_digest_scan() TO service_role;
GRANT EXECUTE ON FUNCTION public.placement_release_scan() TO service_role;
-- enqueue_scoring is a candidate RPC (auth-checked): keep authenticated, drop anonymous
REVOKE ALL ON FUNCTION public.enqueue_scoring(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enqueue_scoring(uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
