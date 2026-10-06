CREATE OR REPLACE FUNCTION public.preflight_assessment(p_assessment_id uuid, p_rank text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid(); a record; camp record; res jsonb; req jsonb; src text; vessel text; input_rank text;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error_code', 'AUTH_REQUIRED'); END IF;
  SELECT id, crew_profile_id INTO a FROM smc_assessments WHERE id = p_assessment_id;
  IF a.id IS NULL OR a.crew_profile_id <> uid THEN RETURN jsonb_build_object('ok', false, 'error_code', 'NOT_FOUND'); END IF;

  SELECT c.rank_required, c.vessel_type INTO camp
    FROM interview_progress ip JOIN interview_campaigns c ON c.id = ip.campaign_id
   WHERE ip.assessment_id = p_assessment_id LIMIT 1;
  IF NOT FOUND THEN
    SELECT c.rank_required, c.vessel_type INTO camp
      FROM interview_invites i JOIN interview_campaigns c ON c.id = i.campaign_id
     WHERE i.assessment_id = p_assessment_id LIMIT 1;
  END IF;

  IF FOUND THEN
    -- Company target rank is authoritative; candidate profile and client input never override it.
    src := 'company_campaign'; input_rank := camp.rank_required; vessel := nullif(trim(coalesce(camp.vessel_type,'')), '');
  ELSE
    -- Self-service: stored profile rank is the only authority. Client p_rank is diagnostic only.
    src := 'crew_profiles.rank';
    SELECT rank, nullif(trim(coalesce(vessel_type,'')), '') INTO input_rank, vessel FROM crew_profiles WHERE id = uid;
  END IF;
  res := resolve_canonical_rank(input_rank);

  IF nullif(trim(coalesce(p_rank,'')), '') IS NOT NULL THEN
    req := resolve_canonical_rank(p_rank);
    IF (req->>'ok')::boolean AND (NOT (res->>'ok')::boolean OR req->>'canonical_rank' IS DISTINCT FROM res->>'canonical_rank') THEN
      INSERT INTO app_events(event_type, message, severity, user_id, metadata)
      VALUES ('preflight_client_rank_mismatch', 'client rank differs from authoritative rank (ignored)', 'info', uid,
              jsonb_build_object('assessment_id', p_assessment_id, 'client_rank', left(p_rank, 100),
                                 'authoritative_rank', input_rank, 'source', src));
    END IF;
  END IF;

  IF NOT (res->>'ok')::boolean THEN
    RETURN jsonb_build_object('ok', false, 'error_code', res->>'error_code', 'source', src, 'input_rank', input_rank);
  END IF;

  res := res || jsonb_build_object('vessel_context', coalesce(vessel, 'General'), 'source', src, 'input_rank', input_rank);
  UPDATE smc_assessments SET preflight_context = res, preflight_source = src, preflight_confirmed_at = NULL
   WHERE id = p_assessment_id AND (preflight_confirmed_at IS NULL OR preflight_context IS DISTINCT FROM res);
  RETURN res || jsonb_build_object('confirmed', (SELECT preflight_confirmed_at IS NOT NULL FROM smc_assessments WHERE id = p_assessment_id));
END $$;
NOTIFY pgrst, 'reload schema';