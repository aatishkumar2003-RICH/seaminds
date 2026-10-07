-- lovable-cron-fallback-reviewed: owner-approved 30-minute support escalation SLA; records the live monitor schedule for reproducibility
CREATE OR REPLACE FUNCTION public.rpc_submit_support_ticket(
  p_submission_id uuid, p_reporter_key text, p_user_id uuid,
  p_contact_email text, p_contact_whatsapp text, p_route_pathname text, p_client_build text,
  p_category text, p_component text, p_operation text, p_error_signature text,
  p_subject text, p_description text, p_assessment_id uuid
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_existing record;
  v_category text := upper(trim(coalesce(p_category,'')));
  v_component text := nullif(upper(trim(coalesce(p_component,''))),'');
  v_operation text := nullif(upper(trim(coalesce(p_operation,''))),'');
  v_sig text := nullif(upper(trim(coalesce(p_error_signature,''))),'');
  v_valid_assessment_id uuid;
  v_valid_crew_profile_id uuid;
  v_asi_id uuid := NULL;
  v_asi_category text := NULL;
  v_asi_error_code text := NULL;
  v_severity text := 'P2_MINOR';
  v_fingerprint text;
  v_incident_id uuid;
  v_incident_ref text;
  v_last_esc timestamptz;
  v_ticket_ref text;
  v_distinct int := 0;
BEGIN
  IF p_submission_id IS NULL OR coalesce(p_reporter_key,'') = '' THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('support_sub:' || p_submission_id::text));

  SELECT t.ticket_ref, t.reporter_key, i.incident_ref INTO v_existing
  FROM public.support_tickets t LEFT JOIN public.support_incidents i ON i.id = t.incident_id
  WHERE t.submission_id = p_submission_id;
  IF FOUND THEN
    IF v_existing.reporter_key IS DISTINCT FROM p_reporter_key THEN
      RAISE EXCEPTION 'SUBMISSION_CONFLICT' USING ERRCODE = '42501';
    END IF;
    RETURN jsonb_build_object('ok',true,'ticket_ref',v_existing.ticket_ref,'incident_ref',v_existing.incident_ref,'idempotent_replay',true);
  END IF;

  IF p_user_id IS NOT NULL THEN
    IF NOT public.support_rate_ok(p_reporter_key, 'support_submit', 10, interval '24 hours') THEN
      RAISE EXCEPTION 'RATE_LIMITED' USING ERRCODE = 'P0001';
    END IF;
  ELSE
    IF NOT public.support_rate_ok(p_reporter_key, 'support_submit', 5, interval '1 hour') THEN
      RAISE EXCEPTION 'RATE_LIMITED' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF v_category NOT IN ('ASSESSMENT','CV_BUILDER','INTERVIEW','AUTH','SYSTEM') THEN v_category := 'SYSTEM'; END IF;
  IF v_component IS NOT NULL AND v_component NOT IN ('ASSESSMENT_RUNNER','CV_PARSER','INTERVIEW_RECORDER','AUTH_GATEWAY','DOCUMENT_WALLET','OFFLINE_SYNC') THEN v_component := NULL; END IF;
  IF v_operation IS NOT NULL AND v_operation NOT IN ('ISSUE_PAPER','SUBMIT_ANSWER','PARSE_CV_PDF','SUBMIT_RECORDING','SESSION_REFRESH','FETCH_DATA') THEN v_operation := NULL; END IF;
  IF v_sig IS NOT NULL AND v_sig NOT IN ('PAPER_NOT_READY','TIMEOUT','STORAGE_LIMIT','SCHEMA_MISMATCH','PREFLIGHT_REQUIRED','SCORING_FAILED','NETWORK_DISCONNECTED','AUTH_SESSION_EXPIRED') THEN v_sig := NULL; END IF;

  IF p_assessment_id IS NOT NULL AND p_user_id IS NOT NULL THEN
    SELECT a.id, cp.id INTO v_valid_assessment_id, v_valid_crew_profile_id
    FROM public.smc_assessments a
    JOIN public.crew_profiles cp ON cp.id = a.crew_profile_id
    WHERE a.id = p_assessment_id AND cp.user_id = p_user_id
    LIMIT 1;
    IF v_valid_assessment_id IS NOT NULL THEN
      SELECT id, category, error_code INTO v_asi_id, v_asi_category, v_asi_error_code
      FROM public.assessment_start_incidents
      WHERE assessment_id = v_valid_assessment_id AND crew_profile_id = v_valid_crew_profile_id AND status = 'OPEN'
      ORDER BY last_at DESC LIMIT 1;
      IF v_asi_id IS NOT NULL THEN
        v_category := 'ASSESSMENT';
        v_component := 'ASSESSMENT_RUNNER';
        v_operation := 'ISSUE_PAPER';
        v_sig := left(upper(trim(v_asi_error_code)), 64);
        IF v_asi_category = 'BACKEND_FAILURE' THEN v_severity := 'P1_DEGRADED'; END IF;
      END IF;
    END IF;
  END IF;

  IF v_sig IN ('PAPER_NOT_READY','PREFLIGHT_REQUIRED','SCHEMA_MISMATCH') THEN v_severity := 'P1_DEGRADED'; END IF;

  IF v_sig IS NOT NULL AND (v_asi_id IS NOT NULL OR (v_component IS NOT NULL AND v_operation IS NOT NULL)) THEN
    v_fingerprint := encode(extensions.digest(v_category||':'||v_component||':'||v_operation||':'||v_sig, 'sha256'), 'hex');
    INSERT INTO public.support_incidents AS si (incident_ref, fingerprint, category, component, operation, error_signature, severity, total_reports)
    VALUES (public._gen_public_ref('SM-INC'), v_fingerprint, v_category, v_component, v_operation, v_sig, v_severity, 1)
    ON CONFLICT (fingerprint) DO UPDATE SET total_reports = si.total_reports + 1, last_seen_at = now()
    RETURNING id, incident_ref, last_escalated_at, severity INTO v_incident_id, v_incident_ref, v_last_esc, v_severity;
  END IF;

  v_ticket_ref := public._gen_public_ref('SM-TCK');
  INSERT INTO public.support_tickets (submission_id, ticket_ref, incident_id, assessment_start_incident_id, assessment_id, user_id, reporter_key,
    contact_email, contact_whatsapp, category, component, operation, error_signature, route_pathname, client_build, subject, description, status)
  VALUES (p_submission_id, v_ticket_ref, v_incident_id, v_asi_id, v_valid_assessment_id, p_user_id, p_reporter_key,
    left(p_contact_email,254), left(p_contact_whatsapp,32), v_category, v_component, v_operation, v_sig, left(p_route_pathname,255), left(p_client_build,64),
    left(p_subject,200), left(p_description,2000), CASE WHEN v_incident_id IS NULL THEN 'RECEIVED' ELSE 'LINKED_INCIDENT' END);

  IF v_incident_id IS NOT NULL THEN
    SELECT count(DISTINCT reporter_key) INTO v_distinct FROM public.support_tickets
    WHERE incident_id = v_incident_id AND created_at > now() - interval '30 minutes';
    IF (v_severity = 'P0_CRITICAL' OR v_distinct >= 3) AND (v_last_esc IS NULL OR v_last_esc < now() - interval '30 minutes') THEN
      UPDATE public.support_incidents SET last_escalated_at = now() WHERE id = v_incident_id;
      INSERT INTO public.app_events (event_type, message, severity, user_id, metadata)
      VALUES ('support_incident_escalated', 'Support incident escalated: ' || v_incident_ref, 'error', NULL,
        jsonb_build_object('incident_ref',v_incident_ref,'fingerprint',v_fingerprint,'category',v_category,'component',v_component,
          'operation',v_operation,'error_signature',v_sig,'severity',v_severity,'distinct_reporters_30m',v_distinct));
    END IF;
  END IF;

  RETURN jsonb_build_object('ok',true,'ticket_ref',v_ticket_ref,'incident_ref',v_incident_ref,'idempotent_replay',false);
END $$;
REVOKE ALL ON FUNCTION public.rpc_submit_support_ticket(uuid,text,uuid,text,text,text,text,text,text,text,text,text,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_submit_support_ticket(uuid,text,uuid,text,text,text,text,text,text,text,text,text,text,uuid) TO service_role;

DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'monitor-agent-every-30min') THEN
    PERFORM cron.unschedule('monitor-agent-every-30min');
  END IF;
  PERFORM cron.schedule('monitor-agent-every-30min', '*/30 * * * *', $job$
    select net.http_post(
      url := 'https://luomzexqgcjtcmdlbevo.supabase.co/functions/v1/monitor-agent',
      headers := jsonb_build_object('Content-Type','application/json','x-worker-secret',(select value from public.admin_settings where key='scoring_worker_secret' limit 1)),
      body := '{"source":"pg_cron"}'::jsonb,
      timeout_milliseconds := 55000
    ) as request_id;
  $job$);
END
$cron$;