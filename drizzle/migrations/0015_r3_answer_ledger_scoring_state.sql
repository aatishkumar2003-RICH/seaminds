
CREATE TABLE public.answer_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id uuid NOT NULL REFERENCES public.issued_papers(id),
  paper_item_id text NOT NULL,
  assessment_id uuid NOT NULL REFERENCES public.smc_assessments(id),
  crew_profile_id uuid NOT NULL,
  item_type text NOT NULL,
  answer text NOT NULL,
  answer_state text NOT NULL DEFAULT 'ANSWERED' CHECK (answer_state IN ('UNANSWERED','ANSWERED')),
  answered_at timestamptz NOT NULL DEFAULT now(),
  scoring_state text NOT NULL CHECK (scoring_state IN ('NOT_REQUIRED','PENDING','EVALUATED','RETRY_REQUIRED')),
  score numeric,
  is_correct boolean,
  result jsonb,
  evaluated_at timestamptz,
  scoring_attempts int NOT NULL DEFAULT 0,
  last_scoring_error text,
  submit_ip text,
  UNIQUE (paper_id, paper_item_id)
);
GRANT SELECT ON public.answer_ledger TO authenticated;
GRANT ALL ON public.answer_ledger TO service_role;
ALTER TABLE public.answer_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Candidate reads own ledger" ON public.answer_ledger FOR SELECT TO authenticated USING (crew_profile_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.protect_answer_ledger() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'answer ledger is append-only'; END IF;
  IF NEW.answer IS DISTINCT FROM OLD.answer OR NEW.answered_at IS DISTINCT FROM OLD.answered_at OR NEW.paper_id IS DISTINCT FROM OLD.paper_id
     OR NEW.paper_item_id IS DISTINCT FROM OLD.paper_item_id OR NEW.assessment_id IS DISTINCT FROM OLD.assessment_id
     OR NEW.crew_profile_id IS DISTINCT FROM OLD.crew_profile_id OR NEW.item_type IS DISTINCT FROM OLD.item_type OR NEW.answer_state IS DISTINCT FROM OLD.answer_state THEN
    RAISE EXCEPTION 'submitted answer is immutable';
  END IF;
  IF OLD.scoring_state = 'EVALUATED' AND (NEW.scoring_state <> 'EVALUATED' OR NEW.score IS DISTINCT FROM OLD.score) THEN
    RAISE EXCEPTION 'evaluated result is final';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_protect_answer_ledger BEFORE UPDATE OR DELETE ON public.answer_ledger FOR EACH ROW EXECUTE FUNCTION public.protect_answer_ledger();

CREATE TABLE public.answer_scoring_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_id uuid NOT NULL UNIQUE REFERENCES public.answer_ledger(id),
  assessment_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','done','dead')),
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 5,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.answer_scoring_jobs FROM anon, authenticated;
GRANT ALL ON public.answer_scoring_jobs TO service_role;
ALTER TABLE public.answer_scoring_jobs ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.answer_scoring_audit (
  id bigserial PRIMARY KEY,
  ledger_id uuid NOT NULL,
  job_id uuid,
  attempt int,
  outcome text NOT NULL,
  reason text,
  model text,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.answer_scoring_audit FROM anon, authenticated;
GRANT ALL ON public.answer_scoring_audit TO service_role;
GRANT USAGE ON SEQUENCE public.answer_scoring_audit_id_seq TO service_role;
ALTER TABLE public.answer_scoring_audit ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.candidate_rate_limits (
  candidate_id uuid NOT NULL,
  scope_id uuid NOT NULL,
  action text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  hits int NOT NULL DEFAULT 0,
  last_ip text,
  PRIMARY KEY (candidate_id, scope_id, action)
);
REVOKE ALL ON public.candidate_rate_limits FROM anon, authenticated;
GRANT ALL ON public.candidate_rate_limits TO service_role;
ALTER TABLE public.candidate_rate_limits ENABLE ROW LEVEL SECURITY;

-- Per-candidate+assessment+action limiter (never keyed on shared IP)
CREATE OR REPLACE FUNCTION public.candidate_rate_ok(p_candidate uuid, p_scope uuid, p_action text, p_max int, p_window interval, p_ip text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  INSERT INTO candidate_rate_limits(candidate_id, scope_id, action, window_start, hits, last_ip)
  VALUES (p_candidate, p_scope, p_action, now(), 1, p_ip)
  ON CONFLICT (candidate_id, scope_id, action) DO UPDATE SET
    hits = CASE WHEN candidate_rate_limits.window_start < now() - p_window THEN 1 ELSE candidate_rate_limits.hits + 1 END,
    window_start = CASE WHEN candidate_rate_limits.window_start < now() - p_window THEN now() ELSE candidate_rate_limits.window_start END,
    last_ip = coalesce(p_ip, candidate_rate_limits.last_ip)
  RETURNING hits INTO r;
  RETURN r.hits <= p_max;
END $$;
REVOKE ALL ON FUNCTION public.candidate_rate_ok(uuid, uuid, text, int, interval, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.candidate_rate_ok(uuid, uuid, text, int, interval, text) TO service_role;

-- Write-first submission: answer committed before/with any grading; idempotent; first answer wins
CREATE OR REPLACE FUNCTION public.submit_paper_answer(p_assessment_id uuid, p_paper_item_id text, p_answer text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); p record; itm jsonb; led record; k jsonb; sel int; ok boolean; ip text; ans text;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error_code', 'AUTH_REQUIRED'); END IF;
  SELECT id, crew_profile_id, items INTO p FROM issued_papers WHERE assessment_id = p_assessment_id AND status = 'ISSUED';
  IF p.id IS NULL OR p.crew_profile_id <> uid THEN RETURN jsonb_build_object('ok', false, 'error_code', 'NOT_FOUND'); END IF;
  SELECT e INTO itm FROM jsonb_array_elements(p.items) e WHERE e->>'paper_item_id' = p_paper_item_id;
  IF itm IS NULL THEN RETURN jsonb_build_object('ok', false, 'error_code', 'UNKNOWN_ITEM'); END IF;
  ans := left(coalesce(p_answer, ''), 4000);

  SELECT * INTO led FROM answer_ledger WHERE paper_id = p.id AND paper_item_id = p_paper_item_id;
  IF led.id IS NULL THEN
    BEGIN ip := split_part(coalesce(current_setting('request.headers', true)::jsonb->>'x-forwarded-for', ''), ',', 1); EXCEPTION WHEN others THEN ip := NULL; END;
    IF NOT candidate_rate_ok(uid, p_assessment_id, 'submit_answer', 200, interval '10 minutes', nullif(ip, '')) THEN
      RETURN jsonb_build_object('ok', false, 'error_code', 'RATE_LIMITED');
    END IF;
    INSERT INTO answer_ledger(paper_id, paper_item_id, assessment_id, crew_profile_id, item_type, answer, scoring_state, submit_ip)
    VALUES (p.id, p_paper_item_id, p_assessment_id, uid, itm->>'type', ans,
            CASE WHEN itm->>'type' = 'mcq' THEN 'PENDING' ELSE 'PENDING' END, nullif(ip, ''))
    ON CONFLICT (paper_id, paper_item_id) DO NOTHING;
    SELECT * INTO led FROM answer_ledger WHERE paper_id = p.id AND paper_item_id = p_paper_item_id;

    IF led.scoring_state = 'PENDING' AND led.item_type = 'mcq' THEN
      SELECT answer_key INTO k FROM issued_paper_keys WHERE paper_id = p.id AND paper_item_id = p_paper_item_id;
      sel := CASE WHEN led.answer ~ '^-?\d+$' THEN led.answer::int ELSE -1 END;
      ok := k IS NOT NULL AND sel = (k->>'correct_index')::int;
      UPDATE answer_ledger SET scoring_state = 'EVALUATED', is_correct = ok, score = CASE WHEN ok THEN 10 ELSE 0 END,
             evaluated_at = now(), result = jsonb_build_object('method', 'deterministic_key')
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
END $$;
REVOKE ALL ON FUNCTION public.submit_paper_answer(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.submit_paper_answer(uuid, text, text) TO authenticated;

-- Worker claim: lease due jobs (optionally one assessment), bump attempts + backoff
CREATE OR REPLACE FUNCTION public.claim_answer_scoring_jobs(p_assessment_id uuid DEFAULT NULL, p_limit int DEFAULT 5)
RETURNS SETOF public.answer_scoring_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  UPDATE answer_scoring_jobs j SET status = 'running', attempts = j.attempts + 1, updated_at = now(),
         next_attempt_at = now() + (power(2, j.attempts + 1)::int * interval '1 minute')
   WHERE j.id IN (SELECT id FROM answer_scoring_jobs
                   WHERE (status = 'pending' OR (status = 'running' AND next_attempt_at <= now()))
                     AND next_attempt_at <= now() AND attempts < max_attempts
                     AND (p_assessment_id IS NULL OR assessment_id = p_assessment_id)
                   ORDER BY created_at LIMIT p_limit FOR UPDATE SKIP LOCKED)
  RETURNING j.*;
END $$;
REVOKE ALL ON FUNCTION public.claim_answer_scoring_jobs(uuid, int) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_answer_scoring_jobs(uuid, int) TO service_role;

NOTIFY pgrst, 'reload schema';
