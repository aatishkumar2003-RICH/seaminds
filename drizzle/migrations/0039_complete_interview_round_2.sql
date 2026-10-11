CREATE OR REPLACE FUNCTION public.open_assessment_v2(p_mode text, p_invite_id uuid DEFAULT NULL::uuid, p_restart boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_mode text := upper(coalesce(p_mode, ''));
  v_ctx text := 'self'; v_round int := 1; v_parent uuid := NULL;
  v_campaign uuid := NULL; v_invite uuid := NULL; v_target_rank text := NULL; v_target_vessel text := NULL;
  inv record; camp record; parent record; linked record; v_email text; v_confirmed timestamptz;
  v_rank jsonb; v_has_cv boolean; v_snap jsonb; v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED'); END IF;
  IF v_mode NOT IN ('PROFILE','CV_BASED') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_MODE');
  END IF;

  IF p_invite_id IS NOT NULL THEN
    SELECT * INTO inv FROM interview_invites WHERE id = p_invite_id FOR UPDATE;
    IF inv.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'INVITE_NOT_FOUND'); END IF;

    IF inv.crew_profile_id IS NULL THEN
      SELECT email, email_confirmed_at INTO v_email, v_confirmed FROM auth.users WHERE id = v_uid;
      IF v_confirmed IS NULL OR inv.invited_email IS NULL
         OR lower(trim(inv.invited_email)) <> lower(trim(coalesce(v_email,''))) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'INVITE_NOT_YOURS');
      END IF;
    ELSIF inv.crew_profile_id <> v_uid THEN
      RETURN jsonb_build_object('ok', false, 'error', 'INVITE_NOT_YOURS');
    END IF;

    SELECT id, status, rank_required, vessel_type INTO camp FROM interview_campaigns WHERE id = inv.campaign_id;
    IF camp.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'CAMPAIGN_NOT_FOUND'); END IF;
    v_campaign := camp.id; v_invite := inv.id;
    v_target_rank := camp.rank_required; v_target_vessel := nullif(trim(coalesce(camp.vessel_type,'')), '');

    IF inv.cv_request_status IN ('REQUESTED','SUBMITTED') AND inv.assessment_id IS NOT NULL THEN
      SELECT id, status INTO parent FROM smc_assessments WHERE id = inv.assessment_id;
      IF parent.id IS NOT NULL AND parent.status = 'completed' THEN
        IF v_mode <> 'CV_BASED' THEN
          RETURN jsonb_build_object('ok', false, 'error', 'ROUND2_REQUIRES_CV_BASED');
        END IF;
        v_round := 2; v_parent := parent.id; v_ctx := 'invite:' || inv.id || ':r2';
      END IF;
    END IF;
    IF v_round = 1 THEN v_ctx := 'invite:' || inv.id || ':r1'; END IF;
    IF v_round = 1 AND v_mode = 'CV_BASED' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'ROUND2_NOT_AUTHORIZED');
    END IF;

    SELECT NULL::uuid AS id, NULL::text AS status, NULL::uuid AS crew_profile_id INTO linked;
    IF v_round = 2 AND inv.round_2_assessment_id IS NOT NULL THEN
      SELECT id, status, crew_profile_id INTO linked FROM smc_assessments WHERE id = inv.round_2_assessment_id;
    ELSIF v_round = 1 AND inv.assessment_id IS NOT NULL THEN
      SELECT id, status, crew_profile_id INTO linked FROM smc_assessments WHERE id = inv.assessment_id;
    END IF;
    IF linked.id IS NOT NULL THEN
      IF linked.crew_profile_id <> v_uid THEN
        RETURN jsonb_build_object('ok', false, 'error', 'INVITE_NOT_YOURS');
      END IF;
      IF linked.status = 'in_progress' THEN
        UPDATE interview_invites SET crew_profile_id = coalesce(crew_profile_id, v_uid) WHERE id = v_invite;
        IF v_round = 1 THEN
          INSERT INTO interview_progress (invite_id, crew_id, assessment_id, campaign_id)
          VALUES (v_invite, v_uid, linked.id, v_campaign)
          ON CONFLICT (crew_id, invite_id) DO UPDATE
            SET assessment_id = EXCLUDED.assessment_id WHERE interview_progress.assessment_id IS NULL;
        END IF;
        RETURN jsonb_build_object('ok', true, 'action', 'resume', 'assessment_id', linked.id,
                                  'mode', v_mode, 'context_id', v_ctx, 'round', v_round);
      END IF;
      RETURN jsonb_build_object('ok', false, 'error',
        CASE WHEN v_round = 2 THEN 'ROUND2_ALREADY_EXISTS' ELSE 'ROUND1_ALREADY_EXISTS' END,
        'assessment_id', linked.id, 'status', linked.status);
    END IF;

    IF camp.status <> 'open' AND NOT EXISTS (
         SELECT 1 FROM smc_assessments WHERE crew_profile_id = v_uid AND assessment_mode = v_mode
            AND context_id = v_ctx AND status = 'in_progress') THEN
      RETURN jsonb_build_object('ok', false, 'error', 'CAMPAIGN_CLOSED');
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_uid::text || ':' || v_mode || ':' || v_ctx));

  IF p_restart AND v_ctx = 'self' THEN
    UPDATE smc_assessments SET status = 'abandoned'
     WHERE crew_profile_id = v_uid AND assessment_mode = v_mode AND context_id = 'self' AND status = 'in_progress';
  END IF;

  SELECT id INTO v_id FROM smc_assessments
   WHERE crew_profile_id = v_uid AND assessment_mode = v_mode AND context_id = v_ctx AND status = 'in_progress'
   LIMIT 1;
  IF v_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'action', 'resume', 'assessment_id', v_id,
                              'mode', v_mode, 'context_id', v_ctx, 'round', v_round);
  END IF;

  v_rank := resolve_canonical_rank(coalesce(v_target_rank, (SELECT rank FROM crew_profiles WHERE id = v_uid)));
  IF NOT coalesce((v_rank->>'ok')::boolean, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', CASE WHEN v_target_rank IS NULL THEN 'NEED_RANK' ELSE 'CAMPAIGN_RANK_UNRESOLVED' END,
                              'rank_error', v_rank->>'error_code');
  END IF;

  IF v_mode = 'CV_BASED' THEN
    SELECT EXISTS (SELECT 1 FROM crew_cv_data c WHERE c.user_id = v_uid
      AND ((jsonb_typeof(c.certificates) = 'array' AND jsonb_array_length(c.certificates) > 0)
        OR (jsonb_typeof(c.sea_service) = 'array' AND jsonb_array_length(c.sea_service) > 0))) INTO v_has_cv;
    IF NOT v_has_cv THEN RETURN jsonb_build_object('ok', false, 'error', 'CV_REQUIRED'); END IF;
  END IF;

  v_snap := build_evidence_snapshot(v_uid, v_mode, v_target_rank, v_target_vessel);

  INSERT INTO smc_assessments (crew_profile_id, status, current_step, scoring_version, assessment_mode,
                               context_id, campaign_id, invite_id, parent_assessment_id,
                               interview_mode, evidence_snapshot, cv_version_hash)
  VALUES (v_uid, 'in_progress', 1, 'v1.1', v_mode, v_ctx, v_campaign, v_invite, v_parent,
          CASE WHEN v_invite IS NULL THEN 'self' ELSE 'company' END,
          v_snap, v_snap->'cv'->>'cv_version_hash')
  RETURNING id INTO v_id;

  IF v_invite IS NOT NULL THEN
    UPDATE interview_invites SET crew_profile_id = coalesce(crew_profile_id, v_uid) WHERE id = v_invite;
    IF v_round = 1 THEN
      UPDATE interview_invites SET assessment_id = v_id,
             status = CASE WHEN status = 'completed' THEN status ELSE 'in_progress' END
       WHERE id = v_invite AND assessment_id IS NULL;
      INSERT INTO interview_progress (invite_id, crew_id, assessment_id, campaign_id)
      VALUES (v_invite, v_uid, v_id, v_campaign)
      ON CONFLICT (crew_id, invite_id) DO UPDATE
        SET assessment_id = EXCLUDED.assessment_id WHERE interview_progress.assessment_id IS NULL;
    ELSE
      UPDATE interview_invites SET round_2_assessment_id = v_id
       WHERE id = v_invite AND round_2_assessment_id IS NULL;
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'action', 'start', 'assessment_id', v_id,
                            'mode', v_mode, 'context_id', v_ctx, 'round', v_round);
END $function$;

CREATE OR REPLACE FUNCTION public.complete_interview(p_invite_id uuid, p_assessment_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); inv record; a record; n int;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok',false,'error_code','AUTH_REQUIRED'); END IF;
  SELECT * INTO inv FROM interview_invites WHERE id = p_invite_id AND crew_profile_id = uid FOR UPDATE;
  IF inv.id IS NULL THEN RETURN jsonb_build_object('ok',false,'error_code','NOT_FOUND'); END IF;
  IF inv.round_2_assessment_id IS NOT NULL AND inv.round_2_assessment_id = p_assessment_id THEN
    IF inv.status <> 'completed' OR inv.assessment_id IS NULL OR inv.cv_request_status NOT IN ('REQUESTED','SUBMITTED','EVALUATED') THEN
      RETURN jsonb_build_object('ok',false,'error_code','ROUND2_NOT_AUTHORIZED'); END IF;
    SELECT * INTO a FROM smc_assessments WHERE id = p_assessment_id AND crew_profile_id = uid;
    IF a.id IS NULL THEN RETURN jsonb_build_object('ok',false,'error_code','NOT_FOUND'); END IF;
    IF a.status <> 'completed' OR a.overall_score IS NULL OR NOT (a.overall_score BETWEEN 0 AND 5)
       OR NOT EXISTS (SELECT 1 FROM issued_papers WHERE assessment_id = p_assessment_id AND status = 'COMPLETED') THEN
      RETURN jsonb_build_object('ok',false,'error_code','SCORING_PENDING'); END IF;
    IF inv.cv_request_status = 'EVALUATED' THEN
      RETURN jsonb_build_object('ok',true,'round',2,'already_completed',true,'score',a.overall_score); END IF;
    UPDATE interview_invites SET cv_request_status = 'EVALUATED' WHERE id = p_invite_id AND crew_profile_id = uid;
    RETURN jsonb_build_object('ok',true,'round',2,'already_completed',false,'score',a.overall_score);
  END IF;
  IF inv.status = 'completed' THEN
    IF inv.assessment_id IS DISTINCT FROM p_assessment_id THEN RETURN jsonb_build_object('ok',false,'error_code','ALREADY_COMPLETED'); END IF;
    SELECT * INTO a FROM smc_assessments WHERE id = p_assessment_id AND crew_profile_id = uid;
    IF inv.overall_score IS NULL OR NOT (inv.overall_score BETWEEN 0 AND 5) OR a.id IS NULL OR a.status <> 'completed'
       OR a.overall_score IS NULL OR NOT (a.overall_score BETWEEN 0 AND 5) THEN
      RETURN jsonb_build_object('ok',false,'error_code','RESULT_INVALID'); END IF;
    RETURN jsonb_build_object('ok',true,'already_completed',true,'score',inv.overall_score);
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

NOTIFY pgrst, 'reload schema';