-- R6: admin-only Assessment Operations Control Room. Read-only views + audited safe actions.
CREATE OR REPLACE FUNCTION public.admin_ops_list(p_search text DEFAULT NULL, p_mode text DEFAULT NULL, p_status text DEFAULT NULL, p_limit integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); res jsonb;
BEGIN
  IF uid IS NULL OR NOT is_admin(uid) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;
  WITH base AS (
    SELECT a.id, a.status a_status, a.current_step, a.started_at, a.completed_at, a.overall_score, a.preflight_context ctx, a.crew_profile_id,
      coalesce(nullif(trim(coalesce(cp.first_name,'')||' '||coalesce(cp.last_name,'')),''), ii.invited_name) cname,
      coalesce(cp.email, ii.invited_email) cemail,
      CASE WHEN ii.id IS NOT NULL THEN 'COMPANY' ELSE 'SMC' END mode,
      p.id paper_id, p.paper_version, p.is_test, coalesce(jsonb_array_length(CASE WHEN jsonb_typeof(p.items)='array' THEN p.items END),0) total,
      (SELECT count(*) FROM answer_ledger l WHERE l.paper_id = p.id AND l.answer_state='ANSWERED') answered,
      (SELECT count(*) FROM answer_ledger l WHERE l.assessment_id = a.id AND l.scoring_state IN ('PENDING','RETRY_REQUIRED')) scoring_open,
      (SELECT count(*) FROM answer_ledger l WHERE l.assessment_id = a.id AND l.scoring_state='RETRY_REQUIRED') retry_required,
      (SELECT coalesce(max(l.scoring_attempts),0) FROM answer_ledger l WHERE l.assessment_id = a.id) max_attempts,
      sl.event l_event, sl.to_state l_state, sl.reason l_reason, sl.created_at l_at,
      rc.id case_id, rc.status case_status, rc.interruption_state case_int, rc.reminders_sent, rc.next_action_at, rc.last_health,
      greatest(a.started_at, a.completed_at, sl.created_at, rc.updated_at,
        (SELECT max(l.answered_at) FROM answer_ledger l WHERE l.assessment_id = a.id)) last_activity
    FROM smc_assessments a
    LEFT JOIN crew_profiles cp ON cp.id = a.crew_profile_id
    LEFT JOIN LATERAL (SELECT * FROM interview_invites i WHERE i.assessment_id = a.id LIMIT 1) ii ON true
    LEFT JOIN LATERAL (SELECT * FROM issued_papers ip WHERE ip.assessment_id = a.id ORDER BY ip.paper_version DESC, ip.issued_at DESC LIMIT 1) p ON true
    LEFT JOIN LATERAL (SELECT * FROM assessment_state_log s WHERE s.assessment_id = a.id ORDER BY s.created_at DESC, s.id DESC LIMIT 1) sl ON true
    LEFT JOIN LATERAL (SELECT * FROM recovery_cases r WHERE r.assessment_id = a.id ORDER BY r.created_at DESC LIMIT 1) rc ON true
    WHERE a.started_at > now() - interval '120 days' OR p.id IS NOT NULL OR rc.id IS NOT NULL
  ), st AS (
    SELECT b.*, CASE
      WHEN b.a_status = 'completed' AND b.scoring_open > 0 AND b.retry_required > 0 THEN 'SCORING_RETRY_REQUIRED'
      WHEN b.a_status = 'completed' AND b.scoring_open > 0 THEN 'SCORING_PENDING'
      WHEN b.a_status = 'completed' THEN 'COMPLETED_SCORED'
      WHEN b.case_status = 'CLOSED' THEN 'CLOSED_ASSISTED'
      WHEN b.case_status = 'RESUMED' THEN 'RESUMED'
      WHEN b.case_status IN ('NOTIFIED','NOTIFY_FAILED') THEN 'NOTIFIED_AWAITING'
      WHEN b.case_status = 'RECOVERABLE' THEN 'RECOVERABLE'
      WHEN b.case_status = 'HEALTH_BLOCKED' THEN 'HEALTH_BLOCKED'
      WHEN b.l_event = 'INTERRUPTED' AND b.l_state = 'USER_PAUSED' THEN 'USER_PAUSED'
      WHEN b.l_event = 'INTERRUPTED' AND b.l_state = 'CONNECTIVITY_INTERRUPTED' THEN 'CONNECTIVITY_INTERRUPTED'
      WHEN b.l_event = 'INTERRUPTED' AND b.l_state = 'SYSTEM_INTERRUPTED' THEN 'SYSTEM_INTERRUPTED'
      WHEN b.l_event = 'INTERRUPTED' THEN 'UNATTRIBUTED_INTERRUPTION'
      WHEN b.case_status = 'OPEN' THEN coalesce(b.case_int, 'UNATTRIBUTED_INTERRUPTION')
      ELSE 'ACTIVE' END ops_status
    FROM base b
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'assessment_id', id, 'candidate_name', cname, 'candidate_email', cemail, 'mode', mode, 'is_test', coalesce(is_test,false),
    'canonical_rank', ctx->>'canonical_rank', 'department', ctx->>'department', 'level', ctx->>'level', 'vessel_context', ctx->>'vessel_context',
    'assessment_status', a_status, 'paper_version', paper_version, 'answered', answered, 'total', total,
    'interruption', jsonb_build_object('event', l_event, 'state', l_state, 'reason', l_reason, 'at', l_at),
    'scoring_open', scoring_open, 'retry_required', retry_required, 'max_scoring_attempts', max_attempts,
    'recovery', CASE WHEN case_id IS NULL THEN NULL ELSE jsonb_build_object('status', case_status, 'reminders_sent', reminders_sent,
       'next_action_at', next_action_at, 'blockers', coalesce(last_health->'blockers','[]'::jsonb), 'health_ok', last_health->'ok') END,
    'ops_status', ops_status, 'last_activity', last_activity, 'overall_score', overall_score
  ) ORDER BY last_activity DESC NULLS LAST), '[]'::jsonb) INTO res
  FROM (SELECT * FROM st
    WHERE (p_mode IS NULL OR mode = p_mode)
      AND (p_status IS NULL OR ops_status = p_status)
      AND (p_search IS NULL OR p_search = '' OR id::text ILIKE '%'||p_search||'%' OR cname ILIKE '%'||p_search||'%'
           OR cemail ILIKE '%'||p_search||'%' OR (ctx->>'canonical_rank') ILIKE '%'||p_search||'%')
    ORDER BY last_activity DESC NULLS LAST LIMIT least(greatest(coalesce(p_limit,100),1),300)) x;
  RETURN res;
END $$;

CREATE OR REPLACE FUNCTION public.admin_ops_timeline(p_assessment_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR NOT is_admin(uid) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;
  RETURN (SELECT coalesce(jsonb_agg(t ORDER BY t->>'at' DESC), '[]'::jsonb) FROM (
    SELECT jsonb_build_object('at', created_at, 'kind', 'state', 'event', event, 'to', to_state, 'reason', reason, 'source', source) t
      FROM assessment_state_log WHERE assessment_id = p_assessment_id
    UNION ALL
    -- recovery events: only whitelisted, non-secret detail keys
    SELECT jsonb_build_object('at', e.created_at, 'kind', 'recovery', 'event', e.event,
      'reason', coalesce(e.detail->>'reason', e.detail->>'error', (SELECT string_agg(x,',') FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(e.detail->'blockers')='array' THEN e.detail->'blockers' ELSE '[]'::jsonb END) x)))
      FROM recovery_events e JOIN recovery_cases c ON c.id = e.case_id WHERE c.assessment_id = p_assessment_id
    UNION ALL
    SELECT jsonb_build_object('at', created_at, 'kind', 'reissue', 'event', 'PAPER_SUPERSEDED', 'reason', reason,
      'disposition', disposition, 'policy', recovery_policy, 'answered_count', answered_count)
      FROM paper_supersessions WHERE assessment_id = p_assessment_id
    ORDER BY 1 LIMIT 200) q(t));
END $$;

CREATE OR REPLACE FUNCTION public.admin_ops_readiness()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); v_bp int; v_sme int; v_ranks int; v_support text; v_verified boolean; v_backoff int; r jsonb;
BEGIN
  IF uid IS NULL OR NOT is_admin(uid) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;
  SELECT count(*) INTO v_bp FROM assessment_blueprints WHERE status = 'ACTIVE' AND NOT is_test;
  SELECT count(*) INTO v_sme FROM assessment_items WHERE approval_status = 'SME_APPROVED' AND is_active AND source_type NOT IN ('TEST_FIXTURE','AI_DRAFT','LEGACY_QUESTION_BANK');
  SELECT count(DISTINCT canonical_rank) INTO v_ranks FROM rank_taxonomy WHERE canonical_rank IS NOT NULL;
  SELECT value INTO v_support FROM admin_settings WHERE key = 'support_contact_email';
  SELECT coalesce(lower(value) = 'true', false) INTO v_verified FROM admin_settings WHERE key = 'support_contact_verified';
  SELECT count(*) INTO v_backoff FROM admin_settings WHERE key LIKE 'smc_backoff:%'
    AND coalesce((CASE WHEN value ~ '^\s*\{' THEN value::jsonb->>'until' END)::bigint, 0) > extract(epoch FROM now())*1000;
  r := jsonb_build_object(
    'canonical_rank_count', v_ranks,
    'production_active_blueprints', v_bp,
    'sme_approved_active_items', v_sme,
    'test_blueprints', (SELECT count(*) FROM assessment_blueprints WHERE status='ACTIVE' AND is_test),
    'legacy_review_items', (SELECT count(*) FROM assessment_items WHERE approval_status <> 'SME_APPROVED'),
    'scoring_jobs_pending', (SELECT count(*) FROM answer_scoring_jobs WHERE status IN ('pending','running')),
    'scoring_jobs_dead', (SELECT count(*) FROM answer_scoring_jobs WHERE status NOT IN ('pending','running','done')),
    'answers_retry_required', (SELECT count(*) FROM answer_ledger WHERE scoring_state = 'RETRY_REQUIRED'),
    'answers_manual_review', (SELECT count(*) FROM answer_ledger WHERE scoring_state = 'RETRY_REQUIRED' AND scoring_attempts >= 5),
    'open_recovery_cases', (SELECT count(*) FROM recovery_cases WHERE status IN ('OPEN','HEALTH_BLOCKED','RECOVERABLE','NOTIFIED','NOTIFY_FAILED')),
    'health_blocked_cases', (SELECT count(*) FROM recovery_cases WHERE status = 'HEALTH_BLOCKED'),
    'support_contact_configured', v_support IS NOT NULL AND v_support <> '',
    'support_contact_verified', coalesce(v_verified,false) AND v_support IS NOT NULL AND v_support <> '',
    'recovery_email_last_error', (SELECT e.detail->>'error' FROM recovery_events e WHERE e.event IN ('NOTIFY_FAILED','SEND_FAILED') ORDER BY e.created_at DESC LIMIT 1),
    'active_backoffs', v_backoff,
    'production_blocked', (v_bp = 0 OR v_sme = 0),
    'checked_at', now());
  RETURN r;
END $$;

-- Audited safe actions. Health/requeue always go through the R5 health gate; no direct send here.
CREATE OR REPLACE FUNCTION public.admin_ops_action(p_assessment_id uuid, p_action text, p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); c record; h jsonb; ok boolean;
BEGIN
  IF uid IS NULL OR NOT is_admin(uid) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;
  IF p_action NOT IN ('HEALTH_CHECK','REQUEUE_RECOVERY','CLOSE_ASSISTED') THEN RETURN jsonb_build_object('ok',false,'error_code','UNKNOWN_ACTION'); END IF;
  SELECT * INTO c FROM recovery_cases WHERE assessment_id = p_assessment_id ORDER BY created_at DESC LIMIT 1;
  h := recovery_health_check(p_assessment_id);
  ok := coalesce((h->>'ok')::boolean, false);

  IF p_action = 'CLOSE_ASSISTED' THEN
    IF coalesce(trim(p_reason),'') = '' OR length(trim(p_reason)) < 5 THEN RETURN jsonb_build_object('ok',false,'error_code','REASON_REQUIRED'); END IF;
    IF c.id IS NULL OR c.status IN ('COMPLETED','CLOSED') THEN RETURN jsonb_build_object('ok',false,'error_code','NO_OPEN_CASE'); END IF;
    UPDATE recovery_cases SET status = 'CLOSED', updated_at = now() WHERE id = c.id;
  ELSIF c.id IS NOT NULL AND c.status IN ('OPEN','HEALTH_BLOCKED','RECOVERABLE','NOTIFIED','NOTIFY_FAILED') THEN
    UPDATE recovery_cases SET last_health = h, updated_at = now(),
      status = CASE WHEN ok THEN (CASE WHEN status = 'HEALTH_BLOCKED' THEN 'OPEN' ELSE status END) ELSE 'HEALTH_BLOCKED' END,
      next_action_at = CASE WHEN p_action = 'REQUEUE_RECOVERY' AND ok THEN now() ELSE next_action_at END
    WHERE id = c.id;
  ELSIF p_action = 'REQUEUE_RECOVERY' THEN
    RETURN jsonb_build_object('ok',false,'error_code','NO_OPEN_CASE','health',h);
  END IF;

  IF c.id IS NOT NULL THEN
    INSERT INTO recovery_events(case_id, event, detail) VALUES (c.id, 'ADMIN_' || p_action,
      jsonb_build_object('by', uid, 'reason', left(p_reason, 300), 'blockers', coalesce(h->'blockers','[]'::jsonb)));
  END IF;
  INSERT INTO assessment_state_log(assessment_id, actor, event, reason, source)
    VALUES (p_assessment_id, uid, 'ADMIN_' || p_action, left(coalesce(p_reason, ''), 300), 'admin_ops');
  RETURN jsonb_build_object('ok', true, 'health_ok', ok, 'blockers', coalesce(h->'blockers','[]'::jsonb),
    'queued', p_action = 'REQUEUE_RECOVERY' AND ok);
END $$;

REVOKE ALL ON FUNCTION public.admin_ops_list(text,text,text,integer), public.admin_ops_timeline(uuid), public.admin_ops_readiness(), public.admin_ops_action(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_ops_list(text,text,text,integer), public.admin_ops_timeline(uuid), public.admin_ops_readiness(), public.admin_ops_action(uuid,text,text) TO authenticated;
NOTIFY pgrst, 'reload schema';