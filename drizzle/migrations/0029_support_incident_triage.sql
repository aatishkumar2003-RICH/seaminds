CREATE OR REPLACE FUNCTION public._gen_public_ref(p_prefix text)
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_alpha constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  v_bytes bytea := extensions.gen_random_bytes(16);
  v_out text := '';
  i int;
BEGIN
  FOR i IN 0..15 LOOP
    v_out := v_out || substr(v_alpha, (get_byte(v_bytes, i) % 32) + 1, 1);
    IF i IN (3,7,11) THEN v_out := v_out || '-'; END IF;
  END LOOP;
  RETURN p_prefix || '-' || v_out;
END $$;
REVOKE ALL ON FUNCTION public._gen_public_ref(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._gen_public_ref(text) TO service_role;

CREATE TABLE IF NOT EXISTS public.support_rate_limits (
  rate_key text NOT NULL CHECK (char_length(rate_key) <= 128),
  action text NOT NULL CHECK (char_length(action) <= 64),
  window_start timestamptz NOT NULL DEFAULT now(),
  hits int NOT NULL DEFAULT 0 CHECK (hits >= 0),
  PRIMARY KEY (rate_key, action)
);
REVOKE ALL ON public.support_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.support_rate_limits TO service_role;
ALTER TABLE public.support_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.support_rate_ok(p_key text, p_action text, p_max int, p_window interval)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_hits int;
BEGIN
  INSERT INTO public.support_rate_limits AS r (rate_key, action, window_start, hits)
  VALUES (p_key, p_action, now(), 1)
  ON CONFLICT (rate_key, action) DO UPDATE SET
    hits = CASE WHEN r.window_start < now() - p_window THEN 1 ELSE r.hits + 1 END,
    window_start = CASE WHEN r.window_start < now() - p_window THEN now() ELSE r.window_start END
  RETURNING hits INTO v_hits;
  RETURN v_hits <= p_max;
END $$;
REVOKE ALL ON FUNCTION public.support_rate_ok(text,text,int,interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.support_rate_ok(text,text,int,interval) TO service_role;

CREATE TABLE IF NOT EXISTS public.support_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_ref text NOT NULL UNIQUE,
  fingerprint text NOT NULL UNIQUE CHECK (char_length(fingerprint) = 64),
  category text NOT NULL CHECK (category IN ('ASSESSMENT','CV_BUILDER','INTERVIEW','AUTH','SYSTEM')),
  component text NOT NULL CHECK (char_length(component) BETWEEN 1 AND 64),
  operation text NOT NULL CHECK (char_length(operation) BETWEEN 1 AND 64),
  error_signature text NOT NULL CHECK (char_length(error_signature) BETWEEN 1 AND 64),
  severity text NOT NULL DEFAULT 'P2_MINOR' CHECK (severity IN ('P0_CRITICAL','P1_DEGRADED','P2_MINOR')),
  status text NOT NULL DEFAULT 'DETECTED' CHECK (status IN ('DETECTED','DIAGNOSED','PROPOSED_FIX','RESOLVED')),
  total_reports int NOT NULL DEFAULT 0 CHECK (total_reports >= 0),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  last_escalated_at timestamptz,
  resolved_by_version text CHECK (resolved_by_version IS NULL OR char_length(resolved_by_version) <= 64)
);
CREATE INDEX IF NOT EXISTS support_incidents_status_sev_idx ON public.support_incidents(status, severity, last_seen_at DESC);
REVOKE ALL ON public.support_incidents FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.support_incidents TO authenticated;
GRANT ALL ON public.support_incidents TO service_role;
ALTER TABLE public.support_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read incidents" ON public.support_incidents FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL UNIQUE,
  ticket_ref text NOT NULL UNIQUE,
  incident_id uuid REFERENCES public.support_incidents(id) ON DELETE SET NULL,
  assessment_start_incident_id uuid REFERENCES public.assessment_start_incidents(id) ON DELETE SET NULL,
  assessment_id uuid,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reporter_key text NOT NULL CHECK (char_length(reporter_key) BETWEEN 1 AND 128),
  contact_email text CHECK (contact_email IS NULL OR char_length(contact_email) <= 254),
  contact_whatsapp text CHECK (contact_whatsapp IS NULL OR char_length(contact_whatsapp) <= 32),
  category text NOT NULL CHECK (category IN ('ASSESSMENT','CV_BUILDER','INTERVIEW','AUTH','SYSTEM')),
  component text CHECK (component IS NULL OR char_length(component) <= 64),
  operation text CHECK (operation IS NULL OR char_length(operation) <= 64),
  error_signature text CHECK (error_signature IS NULL OR char_length(error_signature) <= 64),
  route_pathname text CHECK (route_pathname IS NULL OR char_length(route_pathname) <= 255),
  client_build text CHECK (client_build IS NULL OR char_length(client_build) <= 64),
  subject text NOT NULL CHECK (char_length(subject) BETWEEN 1 AND 200),
  description text NOT NULL CHECK (char_length(description) BETWEEN 1 AND 2000),
  status text NOT NULL DEFAULT 'RECEIVED' CHECK (status IN ('RECEIVED','LINKED_INCIDENT','RESPONDED','RESOLVED','CLOSED')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_tickets_incident_created_idx ON public.support_tickets(incident_id, created_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_incident_reporter_idx ON public.support_tickets(incident_id, reporter_key, created_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_user_created_idx ON public.support_tickets(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_reporter_created_idx ON public.support_tickets(reporter_key, created_at DESC);
REVOKE ALL ON public.support_tickets FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own tickets" ON public.support_tickets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins read all tickets" ON public.support_tickets FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

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
  v_asi record;
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
      SELECT id, category, error_code INTO v_asi
      FROM public.assessment_start_incidents
      WHERE assessment_id = v_valid_assessment_id AND crew_profile_id = v_valid_crew_profile_id AND status = 'OPEN'
      ORDER BY last_at DESC LIMIT 1;
      IF v_asi.id IS NOT NULL THEN
        v_category := 'ASSESSMENT';
        v_component := 'ASSESSMENT_RUNNER';
        v_operation := 'ISSUE_PAPER';
        v_sig := left(upper(trim(v_asi.error_code)), 64);
        IF v_asi.category = 'BACKEND_FAILURE' THEN v_severity := 'P1_DEGRADED'; END IF;
      END IF;
    END IF;
  END IF;

  IF v_sig IN ('PAPER_NOT_READY','PREFLIGHT_REQUIRED','SCHEMA_MISMATCH') THEN v_severity := 'P1_DEGRADED'; END IF;

  IF v_sig IS NOT NULL AND (v_asi.id IS NOT NULL OR (v_component IS NOT NULL AND v_operation IS NOT NULL)) THEN
    v_fingerprint := encode(extensions.digest(v_category||':'||v_component||':'||v_operation||':'||v_sig, 'sha256'), 'hex');
    INSERT INTO public.support_incidents AS si (incident_ref, fingerprint, category, component, operation, error_signature, severity, total_reports)
    VALUES (public._gen_public_ref('SM-INC'), v_fingerprint, v_category, v_component, v_operation, v_sig, v_severity, 1)
    ON CONFLICT (fingerprint) DO UPDATE SET total_reports = si.total_reports + 1, last_seen_at = now()
    RETURNING id, incident_ref, last_escalated_at, severity INTO v_incident_id, v_incident_ref, v_last_esc, v_severity;
  END IF;

  v_ticket_ref := public._gen_public_ref('SM-TCK');
  INSERT INTO public.support_tickets (submission_id, ticket_ref, incident_id, assessment_start_incident_id, assessment_id, user_id, reporter_key,
    contact_email, contact_whatsapp, category, component, operation, error_signature, route_pathname, client_build, subject, description, status)
  VALUES (p_submission_id, v_ticket_ref, v_incident_id, v_asi.id, v_valid_assessment_id, p_user_id, p_reporter_key,
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

CREATE OR REPLACE FUNCTION public.admin_get_incident_diagnostic_bundle(p_incident_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_inc record; v_out jsonb;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  SELECT id, incident_ref, fingerprint, category, component, operation, error_signature, severity, status,
         total_reports, first_seen_at, last_seen_at, last_escalated_at, resolved_by_version
  INTO v_inc FROM public.support_incidents WHERE id = p_incident_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','NOT_FOUND'); END IF;
  SELECT jsonb_build_object(
    'ok', true,
    'incident', to_jsonb(v_inc),
    'distinct_reporters_30m', (SELECT count(DISTINCT reporter_key) FROM support_tickets WHERE incident_id=p_incident_id AND created_at > now()-interval '30 minutes'),
    'distinct_reporters_24h', (SELECT count(DISTINCT reporter_key) FROM support_tickets WHERE incident_id=p_incident_id AND created_at > now()-interval '24 hours'),
    'builds', (SELECT coalesce(jsonb_agg(jsonb_build_object('build',b,'n',n) ORDER BY n DESC),'[]') FROM (SELECT coalesce(client_build,'unknown') b, count(*) n FROM support_tickets WHERE incident_id=p_incident_id GROUP BY 1 ORDER BY 2 DESC LIMIT 20) x),
    'routes', (SELECT coalesce(jsonb_agg(jsonb_build_object('route',r,'n',n) ORDER BY n DESC),'[]') FROM (SELECT coalesce(route_pathname,'unknown') r, count(*) n FROM support_tickets WHERE incident_id=p_incident_id GROUP BY 1 ORDER BY 2 DESC LIMIT 20) y),
    'linked_start_incidents', (SELECT coalesce(jsonb_agg(jsonb_build_object('id',s.id,'category',s.category,'error_code',s.error_code,'fn_path',s.fn_path,'client_build',s.client_build,'status',s.status,'occurrences',s.occurrences,'first_at',s.first_at,'last_at',s.last_at)),'[]')
      FROM assessment_start_incidents s WHERE s.id IN (SELECT DISTINCT assessment_start_incident_id FROM support_tickets WHERE incident_id=p_incident_id AND assessment_start_incident_id IS NOT NULL LIMIT 20))
  ) INTO v_out;
  RETURN v_out;
END $$;
REVOKE ALL ON FUNCTION public.admin_get_incident_diagnostic_bundle(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_incident_diagnostic_bundle(uuid) TO authenticated, service_role;