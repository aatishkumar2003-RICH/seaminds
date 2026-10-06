CREATE OR REPLACE FUNCTION public.recovery_health_check(p_assessment_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a record; ctx jsonb; paper record; blockers text[] := '{}'; bp_ok boolean; camp record; b text; adm boolean;
BEGIN
  SELECT id, status, crew_profile_id, preflight_context, preflight_confirmed_at INTO a FROM smc_assessments WHERE id = p_assessment_id;
  IF a.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'blockers', jsonb_build_array('assessment_missing')); END IF;
  IF a.status = 'completed' THEN blockers := array_append(blockers, 'already_completed'); END IF;
  ctx := a.preflight_context;
  IF a.preflight_confirmed_at IS NULL OR NOT coalesce((ctx->>'ok')::boolean, false) OR ctx->>'canonical_rank' IS NULL THEN blockers := array_append(blockers, 'context_invalid'); END IF;
  SELECT * INTO paper FROM issued_papers WHERE assessment_id = p_assessment_id AND status = 'ISSUED';
  IF paper.id IS NULL THEN
    IF EXISTS (SELECT 1 FROM issued_papers WHERE assessment_id = p_assessment_id AND status <> 'SUPERSEDED_SYSTEM_ERROR') THEN
      blockers := array_append(blockers, 'paper_closed');
    ELSE
      adm := is_admin(a.crew_profile_id);
      SELECT EXISTS (SELECT 1 FROM assessment_blueprints bb WHERE bb.status = 'ACTIVE' AND bb.canonical_rank = ctx->>'canonical_rank'
        AND bb.department = ctx->>'department' AND bb.level = ctx->>'level'
        AND bb.vessel_context IN (coalesce(ctx->>'vessel_context','General'), 'General') AND (NOT bb.is_test OR adm)) INTO bp_ok;
      IF NOT bp_ok THEN blockers := array_append(blockers, 'blueprint_not_ready'); END IF;
    END IF;
  END IF;
  SELECT value INTO b FROM admin_settings WHERE key = 'smc_backoff:' || p_assessment_id::text;
  IF b IS NOT NULL AND coalesce((b::jsonb->>'until')::bigint, 0) > (extract(epoch FROM now()) * 1000) THEN blockers := array_append(blockers, 'paper_backoff_active'); END IF;
  IF EXISTS (SELECT 1 FROM answer_scoring_jobs WHERE assessment_id = p_assessment_id AND status IN ('pending','running') AND created_at < now() - interval '2 hours') THEN
    blockers := array_append(blockers, 'scoring_queue_stalled');
  END IF;
  SELECT c.status, c.closes_at INTO camp FROM interview_progress ip JOIN interview_campaigns c ON c.id = ip.campaign_id WHERE ip.assessment_id = p_assessment_id LIMIT 1;
  IF FOUND AND ((camp.closes_at IS NOT NULL AND camp.closes_at < now()) OR coalesce(camp.status, 'open') IN ('closed','cancelled','archived')) THEN
    blockers := array_append(blockers, 'campaign_closed');
  END IF;
  RETURN jsonb_build_object('ok', cardinality(blockers) = 0, 'blockers', to_jsonb(blockers), 'checked_at', now(),
    'has_active_paper', paper.id IS NOT NULL);
END $$;
REVOKE ALL ON FUNCTION public.recovery_health_check(uuid) FROM PUBLIC, anon, authenticated;