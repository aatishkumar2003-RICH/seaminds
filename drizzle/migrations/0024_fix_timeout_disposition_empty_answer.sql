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
      VALUES (p.id, p_paper_item_id, p_assessment_id, uid, itm->>'type', '', 'UNANSWERED', 'NOT_REQUIRED', 0, now(),
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
NOTIFY pgrst, 'reload schema';