CREATE TABLE public.recovery_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.smc_assessments(id) ON DELETE CASCADE,
  crew_profile_id uuid NOT NULL,
  mode text NOT NULL DEFAULT 'self' CHECK (mode IN ('self','company')),
  interruption_state text NOT NULL,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','HEALTH_BLOCKED','RECOVERABLE','NOTIFIED','NOTIFY_FAILED','RESUMED','COMPLETED','CLOSED')),
  reminders_sent int NOT NULL DEFAULT 0,
  next_action_at timestamptz,
  last_health jsonb,
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX recovery_cases_one_active ON public.recovery_cases(assessment_id) WHERE status NOT IN ('RESUMED','COMPLETED','CLOSED');
GRANT SELECT ON public.recovery_cases TO authenticated;
GRANT ALL ON public.recovery_cases TO service_role;
ALTER TABLE public.recovery_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or admin read recovery cases" ON public.recovery_cases FOR SELECT TO authenticated
  USING (crew_profile_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TABLE public.recovery_events (
  id bigserial PRIMARY KEY,
  case_id uuid NOT NULL REFERENCES public.recovery_cases(id) ON DELETE CASCADE,
  event text NOT NULL,
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.recovery_events TO authenticated;
GRANT ALL ON public.recovery_events TO service_role;
ALTER TABLE public.recovery_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read recovery events" ON public.recovery_events FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- Only a SHA-256 hash is stored; the raw token exists only in the email.
CREATE TABLE public.recovery_tokens (
  token_hash text PRIMARY KEY,
  case_id uuid NOT NULL REFERENCES public.recovery_cases(id) ON DELETE CASCADE,
  assessment_id uuid NOT NULL,
  crew_profile_id uuid NOT NULL,
  purpose text NOT NULL DEFAULT 'RESUME_ASSESSMENT' CHECK (purpose = 'RESUME_ASSESSMENT'),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.recovery_tokens TO service_role;
ALTER TABLE public.recovery_tokens ENABLE ROW LEVEL SECURITY;
-- no client policies: tokens are never readable from the browser

CREATE OR REPLACE FUNCTION public.recovery_policy() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('include_user_paused', false, 'first_delay_minutes', 10, 'recheck_minutes', 30,
                            'reminder_hours', jsonb_build_array(24, 72), 'token_ttl_minutes', 60)
         || coalesce((SELECT value::jsonb FROM admin_settings WHERE key = 'recovery_policy'), '{}'::jsonb)
$$;
REVOKE ALL ON FUNCTION public.recovery_policy() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.recovery_log(p_case uuid, p_event text, p_detail jsonb DEFAULT NULL) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO recovery_events(case_id, event, detail) VALUES (p_case, p_event, p_detail);
$$;
REVOKE ALL ON FUNCTION public.recovery_log(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;

-- Health gate: prove the attempt is actually recoverable before telling anyone it is.
CREATE OR REPLACE FUNCTION public.recovery_health_check(p_assessment_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a record; ctx jsonb; paper record; blockers text[] := '{}'; bp_ok boolean; camp record; b text; adm boolean;
BEGIN
  SELECT id, status, crew_profile_id, preflight_context, preflight_confirmed_at INTO a FROM smc_assessments WHERE id = p_assessment_id;
  IF a.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'blockers', jsonb_build_array('assessment_missing')); END IF;
  IF a.status = 'completed' THEN blockers := blockers || 'already_completed'; END IF;
  ctx := a.preflight_context;
  IF a.preflight_confirmed_at IS NULL OR NOT coalesce((ctx->>'ok')::boolean, false) OR ctx->>'canonical_rank' IS NULL THEN blockers := blockers || 'context_invalid'; END IF;
  SELECT * INTO paper FROM issued_papers WHERE assessment_id = p_assessment_id AND status = 'ISSUED';
  IF paper.id IS NULL THEN
    IF EXISTS (SELECT 1 FROM issued_papers WHERE assessment_id = p_assessment_id AND status <> 'SUPERSEDED_SYSTEM_ERROR') THEN
      blockers := blockers || 'paper_closed';
    ELSE
      adm := is_admin(a.crew_profile_id);
      SELECT EXISTS (SELECT 1 FROM assessment_blueprints bb WHERE bb.status = 'ACTIVE' AND bb.canonical_rank = ctx->>'canonical_rank'
        AND bb.department = ctx->>'department' AND bb.level = ctx->>'level'
        AND bb.vessel_context IN (coalesce(ctx->>'vessel_context','General'), 'General') AND (NOT bb.is_test OR adm)) INTO bp_ok;
      IF NOT bp_ok THEN blockers := blockers || 'blueprint_not_ready'; END IF;
    END IF;
  END IF;
  SELECT value INTO b FROM admin_settings WHERE key = 'smc_backoff:' || p_assessment_id::text;
  IF b IS NOT NULL AND coalesce((b::jsonb->>'until')::bigint, 0) > (extract(epoch FROM now()) * 1000) THEN blockers := blockers || 'paper_backoff_active'; END IF;
  IF EXISTS (SELECT 1 FROM answer_scoring_jobs WHERE assessment_id = p_assessment_id AND status IN ('pending','running') AND created_at < now() - interval '2 hours') THEN
    blockers := blockers || 'scoring_queue_stalled';
  END IF;
  SELECT c.status, c.closes_at INTO camp FROM interview_progress ip JOIN interview_campaigns c ON c.id = ip.campaign_id WHERE ip.assessment_id = p_assessment_id LIMIT 1;
  IF FOUND AND ((camp.closes_at IS NOT NULL AND camp.closes_at < now()) OR coalesce(camp.status, 'open') IN ('closed','cancelled','archived')) THEN
    blockers := blockers || 'campaign_closed';
  END IF;
  RETURN jsonb_build_object('ok', cardinality(blockers) = 0, 'blockers', to_jsonb(blockers), 'checked_at', now(),
    'has_active_paper', paper.id IS NOT NULL);
END $$;
REVOKE ALL ON FUNCTION public.recovery_health_check(uuid) FROM PUBLIC, anon, authenticated;

-- Open/close cases automatically from the R4 checkpoint state
CREATE OR REPLACE FUNCTION public.recovery_on_checkpoint() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pol jsonb := recovery_policy(); cid uuid; m text; tst boolean;
BEGIN
  IF NEW.interruption_state IS NOT NULL AND NEW.interruption_state IS DISTINCT FROM OLD.interruption_state
     AND (NEW.interruption_state <> 'USER_PAUSED' OR coalesce((pol->>'include_user_paused')::boolean, false)) THEN
    SELECT id INTO cid FROM recovery_cases WHERE assessment_id = NEW.assessment_id AND status NOT IN ('RESUMED','COMPLETED','CLOSED');
    IF cid IS NULL THEN
      m := CASE WHEN EXISTS (SELECT 1 FROM interview_progress WHERE assessment_id = NEW.assessment_id) THEN 'company' ELSE 'self' END;
      SELECT coalesce(bool_or(is_test), false) INTO tst FROM issued_papers WHERE assessment_id = NEW.assessment_id;
      INSERT INTO recovery_cases(assessment_id, crew_profile_id, mode, interruption_state, next_action_at, is_test)
      VALUES (NEW.assessment_id, NEW.crew_profile_id, m, NEW.interruption_state,
              now() + make_interval(mins => coalesce((pol->>'first_delay_minutes')::int, 10)), tst)
      RETURNING id INTO cid;
      PERFORM recovery_log(cid, 'INTERRUPTION_RECORDED', jsonb_build_object('state', NEW.interruption_state, 'reason', NEW.interruption_reason));
    ELSE
      UPDATE recovery_cases SET interruption_state = NEW.interruption_state, updated_at = now() WHERE id = cid;
      PERFORM recovery_log(cid, 'INTERRUPTION_UPDATED', jsonb_build_object('state', NEW.interruption_state));
    END IF;
  ELSIF NEW.interruption_state IS NULL AND OLD.interruption_state IS NOT NULL THEN
    FOR cid IN UPDATE recovery_cases SET status = 'RESUMED', next_action_at = NULL, updated_at = now()
               WHERE assessment_id = NEW.assessment_id AND status NOT IN ('RESUMED','COMPLETED','CLOSED') RETURNING id LOOP
      UPDATE recovery_tokens SET revoked_at = now() WHERE case_id = cid AND used_at IS NULL AND revoked_at IS NULL;
      PERFORM recovery_log(cid, 'CANDIDATE_RESUMED', NULL);
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_recovery_on_checkpoint AFTER UPDATE ON public.assessment_checkpoints FOR EACH ROW EXECUTE FUNCTION public.recovery_on_checkpoint();

CREATE OR REPLACE FUNCTION public.recovery_on_assessment_done() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cid uuid;
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    FOR cid IN UPDATE recovery_cases SET status = 'COMPLETED', next_action_at = NULL, updated_at = now()
               WHERE assessment_id = NEW.id AND status NOT IN ('RESUMED','COMPLETED','CLOSED') RETURNING id LOOP
      UPDATE recovery_tokens SET revoked_at = now() WHERE case_id = cid AND used_at IS NULL AND revoked_at IS NULL;
      PERFORM recovery_log(cid, 'ASSESSMENT_COMPLETED', NULL);
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_recovery_on_assessment_done AFTER UPDATE OF status ON public.smc_assessments FOR EACH ROW EXECUTE FUNCTION public.recovery_on_assessment_done();

-- Worker: health-gate due cases, mint single-use token, create in-app message; returns send list (service_role only)
CREATE OR REPLACE FUNCTION public.recovery_claim_due(p_assessment_id uuid DEFAULT NULL, p_limit int DEFAULT 20) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE pol jsonb := recovery_policy(); c record; h jsonb; raw text; out jsonb := '[]'::jsonb; em text; fn text; route text; itok text;
  hours jsonb := coalesce(pol->'reminder_hours', '[]'::jsonb); nxt timestamptz; sup text;
BEGIN
  SELECT value INTO sup FROM admin_settings WHERE key = 'support_contact_email'
    AND EXISTS (SELECT 1 FROM admin_settings WHERE key = 'support_contact_verified' AND value = 'true');
  FOR c IN SELECT * FROM recovery_cases
    WHERE status IN ('OPEN','HEALTH_BLOCKED','NOTIFIED','NOTIFY_FAILED') AND next_action_at IS NOT NULL
      AND (p_assessment_id IS NULL AND next_action_at <= now() OR assessment_id = p_assessment_id)
    ORDER BY next_action_at LIMIT p_limit FOR UPDATE SKIP LOCKED
  LOOP
    h := recovery_health_check(c.assessment_id);
    PERFORM recovery_log(c.id, 'HEALTH_CHECK', h);
    IF NOT (h->>'ok')::boolean THEN
      IF h->'blockers' ? 'already_completed' OR h->'blockers' ? 'campaign_closed' OR h->'blockers' ? 'paper_closed' THEN
        UPDATE recovery_cases SET status = 'CLOSED', next_action_at = NULL, last_health = h, updated_at = now() WHERE id = c.id;
        UPDATE recovery_tokens SET revoked_at = now() WHERE case_id = c.id AND used_at IS NULL AND revoked_at IS NULL;
        PERFORM recovery_log(c.id, 'CLOSED', h->'blockers');
      ELSE
        UPDATE recovery_cases SET status = 'HEALTH_BLOCKED', last_health = h, updated_at = now(),
          next_action_at = now() + make_interval(mins => coalesce((pol->>'recheck_minutes')::int, 30)) WHERE id = c.id;
      END IF;
      CONTINUE;
    END IF;
    -- Reminder budget: first notice + one per configured interval
    IF c.reminders_sent > jsonb_array_length(hours) THEN
      UPDATE recovery_cases SET next_action_at = NULL, updated_at = now() WHERE id = c.id;
      PERFORM recovery_log(c.id, 'REMINDERS_EXHAUSTED', NULL);
      CONTINUE;
    END IF;
    nxt := CASE WHEN c.reminders_sent < jsonb_array_length(hours)
                THEN now() + make_interval(hours => (hours->>c.reminders_sent)::int) ELSE NULL END;
    UPDATE recovery_tokens SET revoked_at = now() WHERE case_id = c.id AND used_at IS NULL AND revoked_at IS NULL;
    raw := encode(gen_random_bytes(32), 'hex');
    INSERT INTO recovery_tokens(token_hash, case_id, assessment_id, crew_profile_id, expires_at)
    VALUES (encode(digest(raw, 'sha256'), 'hex'), c.id, c.assessment_id, c.crew_profile_id,
            now() + make_interval(mins => coalesce((pol->>'token_ttl_minutes')::int, 60)));
    UPDATE recovery_cases SET status = 'RECOVERABLE', last_health = h, reminders_sent = reminders_sent + 1, next_action_at = nxt, updated_at = now() WHERE id = c.id;
    PERFORM recovery_log(c.id, 'RECOVERABLE', jsonb_build_object('reminder', c.reminders_sent + 1));
    SELECT i.token INTO itok FROM interview_progress ip JOIN interview_invites i ON i.id = ip.invite_id WHERE ip.assessment_id = c.assessment_id LIMIT 1;
    route := CASE WHEN c.mode = 'company' AND itok IS NOT NULL THEN '/interview/' || itok || '/exam' ELSE '/app' END;
    IF c.reminders_sent = 0 THEN
      INSERT INTO notifications(crew_id, kind, title, body, icon, screen, link)
      VALUES (c.crew_profile_id, 'assessment_recovery', 'Your assessment is ready to resume',
              'An earlier interruption was a technical issue. Your attempt and answers are saved, you are not penalised, and you can continue where you left off.',
              '⚓', CASE WHEN c.mode = 'self' THEN 'smc' END, CASE WHEN c.mode = 'company' THEN route END);
      PERFORM recovery_log(c.id, 'IN_APP_MESSAGE_CREATED', NULL);
    END IF;
    SELECT u.email, coalesce(cp.first_name, '') INTO em, fn FROM auth.users u LEFT JOIN crew_profiles cp ON cp.id = u.id WHERE u.id = c.crew_profile_id;
    IF sup IS NULL THEN PERFORM recovery_log(c.id, 'SUPPORT_CONTACT_NOT_CONFIGURED', NULL); END IF;
    out := out || jsonb_build_object('case_id', c.id, 'email', em, 'first_name', fn, 'mode', c.mode, 'token', raw,
                                     'reminder', c.reminders_sent + 1, 'support_email', sup, 'is_test', c.is_test);
  END LOOP;
  RETURN out;
END $$;
REVOKE ALL ON FUNCTION public.recovery_claim_due(uuid, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recovery_claim_due(uuid, int) TO service_role;

CREATE OR REPLACE FUNCTION public.recovery_mark_sent(p_case uuid, p_ok boolean, p_error text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE recovery_cases SET status = CASE WHEN p_ok THEN 'NOTIFIED' ELSE 'NOTIFY_FAILED' END,
    next_action_at = CASE WHEN p_ok THEN next_action_at ELSE now() + interval '30 minutes' END, updated_at = now()
  WHERE id = p_case AND status = 'RECOVERABLE';
  PERFORM recovery_log(p_case, CASE WHEN p_ok THEN 'EMAIL_SENT' ELSE 'EMAIL_FAILED' END, CASE WHEN p_error IS NULL THEN NULL ELSE jsonb_build_object('error', left(p_error, 120)) END);
END $$;
REVOKE ALL ON FUNCTION public.recovery_mark_sent(uuid, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recovery_mark_sent(uuid, boolean, text) TO service_role;

-- Candidate redeems link: must be signed in as the bound candidate; single-use; no paper data returned.
CREATE OR REPLACE FUNCTION public.redeem_recovery_token(p_token text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE uid uuid := auth.uid(); t record; cs record; itok text;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error_code', 'SIGN_IN_REQUIRED'); END IF;
  IF p_token IS NULL OR length(p_token) <> 64 THEN RETURN jsonb_build_object('ok', false, 'error_code', 'INVALID'); END IF;
  SELECT * INTO t FROM recovery_tokens WHERE token_hash = encode(digest(p_token, 'sha256'), 'hex') FOR UPDATE;
  IF t.token_hash IS NULL THEN RETURN jsonb_build_object('ok', false, 'error_code', 'INVALID'); END IF;
  IF t.crew_profile_id <> uid THEN RETURN jsonb_build_object('ok', false, 'error_code', 'WRONG_ACCOUNT'); END IF;
  IF t.used_at IS NOT NULL OR t.revoked_at IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'error_code', 'ALREADY_USED'); END IF;
  IF t.expires_at < now() THEN RETURN jsonb_build_object('ok', false, 'error_code', 'EXPIRED'); END IF;
  SELECT * INTO cs FROM recovery_cases WHERE id = t.case_id;
  IF cs.status IN ('COMPLETED','CLOSED') THEN RETURN jsonb_build_object('ok', false, 'error_code', 'CLOSED'); END IF;
  UPDATE recovery_tokens SET used_at = now() WHERE token_hash = t.token_hash;
  PERFORM recovery_log(t.case_id, 'LINK_REDEEMED', NULL);
  SELECT i.token INTO itok FROM interview_progress ip JOIN interview_invites i ON i.id = ip.invite_id WHERE ip.assessment_id = t.assessment_id LIMIT 1;
  RETURN jsonb_build_object('ok', true, 'mode', cs.mode,
    'route', CASE WHEN cs.mode = 'company' AND itok IS NOT NULL THEN '/interview/' || itok || '/exam' ELSE '/app?screen=smc' END);
END $$;
GRANT EXECUTE ON FUNCTION public.redeem_recovery_token(text) TO authenticated;

-- Candidate in-app banner source
CREATE OR REPLACE FUNCTION public.get_my_recovery() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('assessment_id', assessment_id, 'mode', mode)), '[]'::jsonb)
  FROM recovery_cases WHERE crew_profile_id = auth.uid() AND status IN ('RECOVERABLE','NOTIFIED','NOTIFY_FAILED');
$$;
GRANT EXECUTE ON FUNCTION public.get_my_recovery() TO authenticated;

-- TEST HOOK (admin only, TEST papers only): simulate a technical interruption and make the case due now.
CREATE OR REPLACE FUNCTION public.recovery_test_simulate(p_assessment_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR NOT is_admin(uid) THEN RETURN jsonb_build_object('ok', false, 'error_code', 'FORBIDDEN'); END IF;
  IF NOT EXISTS (SELECT 1 FROM issued_papers WHERE assessment_id = p_assessment_id AND status = 'ISSUED' AND is_test) THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'TEST_PAPER_REQUIRED');
  END IF;
  PERFORM record_system_interruption(p_assessment_id, 'test_simulated');
  UPDATE recovery_cases SET next_action_at = now(), is_test = true WHERE assessment_id = p_assessment_id AND status NOT IN ('RESUMED','COMPLETED','CLOSED');
  RETURN jsonb_build_object('ok', true);
END $$;
GRANT EXECUTE ON FUNCTION public.recovery_test_simulate(uuid) TO authenticated;

-- Cron backstop: kick the notifier only when something is due
CREATE OR REPLACE FUNCTION public.process_recovery_queue() RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_secret text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM recovery_cases WHERE status IN ('OPEN','HEALTH_BLOCKED','NOTIFIED','NOTIFY_FAILED') AND next_action_at <= now()) THEN RETURN 'idle'; END IF;
  SELECT value INTO v_secret FROM admin_settings WHERE key = 'scoring_worker_secret';
  PERFORM net.http_post(
    url := 'https://luomzexqgcjtcmdlbevo.supabase.co/functions/v1/recovery-notify',
    headers := jsonb_build_object('Content-Type','application/json','x-worker-secret', coalesce(v_secret,''),
      'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1b216ZXhxZ2NqdGNtZGxiZXZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0OTY4NjEsImV4cCI6MjA4NzA3Mjg2MX0.QJoLu7WC-9h4qoTEXfOMPu1OJTmu8hzBuOGLPOq1IuY'),
    body := '{}'::jsonb, timeout_milliseconds := 55000);
  RETURN 'kicked';
END $$;
REVOKE ALL ON FUNCTION public.process_recovery_queue() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.process_scoring_jobs()
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE j record; n_done int := 0; n_sent int := 0; n_dead int := 0; v_secret text;
BEGIN
  SELECT value INTO v_secret FROM admin_settings WHERE key = 'scoring_worker_secret';
  UPDATE scoring_jobs sj SET status='done', completed_at = now()
  FROM smc_assessments a
  WHERE sj.assessment_id = a.id AND sj.status IN ('pending','sent')
    AND a.status = 'completed' AND a.overall_score IS NOT NULL;
  GET DIAGNOSTICS n_done = ROW_COUNT;
  WITH dead AS (
    UPDATE scoring_jobs SET status='failed'
    WHERE status IN ('pending','sent') AND attempts >= 5 AND next_attempt_at <= now()
    RETURNING assessment_id, attempts, last_error)
  INSERT INTO app_events (event_type, message, severity, metadata)
  SELECT 'scoring_dead_letter', 'Assessment scoring failed after retries — manual review needed', 'error',
         jsonb_build_object('assessment_id', assessment_id, 'attempts', attempts, 'last_error', last_error)
  FROM dead;
  GET DIAGNOSTICS n_dead = ROW_COUNT;
  FOR j IN SELECT * FROM scoring_jobs
    WHERE status IN ('pending','sent') AND attempts < 5 AND next_attempt_at <= now()
    ORDER BY created_at LIMIT 3
  LOOP
    PERFORM net.http_post(
      url := 'https://luomzexqgcjtcmdlbevo.supabase.co/functions/v1/score-assessment',
      headers := jsonb_build_object('Content-Type','application/json',
        'x-worker-secret', coalesce(v_secret,''),
        'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1b216ZXhxZ2NqdGNtZGxiZXZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0OTY4NjEsImV4cCI6MjA4NzA3Mjg2MX0.QJoLu7WC-9h4qoTEXfOMPu1OJTmu8hzBuOGLPOq1IuY',
        'Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1b216ZXhxZ2NqdGNtZGxiZXZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0OTY4NjEsImV4cCI6MjA4NzA3Mjg2MX0.QJoLu7WC-9h4qoTEXfOMPu1OJTmu8hzBuOGLPOq1IuY'),
      body := j.payload, timeout_milliseconds := 55000);
    UPDATE scoring_jobs SET status='sent', attempts = attempts + 1,
      next_attempt_at = now() + (power(2, attempts + 1)::int * interval '1 minute')
      WHERE id = j.id;
    n_sent := n_sent + 1;
  END LOOP;
  PERFORM public.process_answer_scoring_queue();
  PERFORM public.process_recovery_queue(); -- R5: health-gated recovery notices
  RETURN format('queue: healed=%s sent=%s dead=%s', n_done, n_sent, n_dead);
END $function$;

NOTIFY pgrst, 'reload schema';