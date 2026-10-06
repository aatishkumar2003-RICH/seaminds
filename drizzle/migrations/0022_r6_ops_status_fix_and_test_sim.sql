CREATE OR REPLACE FUNCTION public.admin_ops_list(p_search text DEFAULT NULL, p_mode text DEFAULT NULL, p_status text DEFAULT NULL, p_limit integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); res jsonb;
BEGIN
  IF uid IS NULL OR NOT is_admin(uid) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;
  WITH base AS (
    SELECT a.id, a.status a_status, a.current_step, a.started_at, a.completed_at, a.overall_score, a.preflight_context ctx, a.crew_profile_id,
      coalesce(nullif(trim(coalesce(cp.first_name,'')||' '||coalesce(cp.last_name,'')),''), ii.invited_name) cname,
      coalesce(cp.email, ii.invited_email) cemail,
      CASE WHEN ii.id IS NOT NULL OR EXISTS (SELECT 1 FROM interview_progress ip2 WHERE ip2.assessment_id = a.id) THEN 'COMPANY' ELSE 'SMC' END mode,
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
    LEFT JOIN LATERAL (SELECT * FROM assessment_state_log s WHERE s.assessment_id = a.id AND s.event NOT LIKE 'ADMIN\_%' ORDER BY s.created_at DESC, s.id DESC LIMIT 1) sl ON true
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

-- TEST ONLY: admin + active TEST paper owned by the calling admin. Ensures a checkpoint exists so the R5 case opens.
CREATE OR REPLACE FUNCTION public.admin_ops_test_simulate(p_assessment_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); p record; r jsonb;
BEGIN
  IF uid IS NULL OR NOT is_admin(uid) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;
  SELECT * INTO p FROM issued_papers WHERE assessment_id = p_assessment_id AND status = 'ISSUED' AND is_test AND crew_profile_id = uid;
  IF p.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error_code', 'TEST_PAPER_REQUIRED'); END IF;
  INSERT INTO assessment_checkpoints(assessment_id, crew_profile_id, paper_id) VALUES (p_assessment_id, uid, p.id)
    ON CONFLICT DO NOTHING;
  r := recovery_test_simulate(p_assessment_id);
  INSERT INTO assessment_state_log(assessment_id, actor, event, reason, source) VALUES (p_assessment_id, uid, 'ADMIN_TEST_SIMULATE', 'TEST', 'admin_ops');
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.admin_ops_test_simulate(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_ops_test_simulate(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';