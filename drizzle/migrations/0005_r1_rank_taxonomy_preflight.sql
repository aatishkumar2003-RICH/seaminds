ALTER TABLE public.rank_taxonomy
  ADD COLUMN IF NOT EXISTS canonical_rank text,
  ADD COLUMN IF NOT EXISTS level text,
  ADD COLUMN IF NOT EXISTS department_label text;

UPDATE public.rank_taxonomy SET canonical_rank = CASE rank_pattern
  WHEN 'captain' THEN 'Master' WHEN 'master' THEN 'Master'
  WHEN 'chief mate' THEN 'Chief Officer' WHEN 'chief officer' THEN 'Chief Officer'
  WHEN 'second officer' THEN '2nd Officer' WHEN '2nd officer' THEN '2nd Officer'
  WHEN 'third officer' THEN '3rd Officer' WHEN '3rd officer' THEN '3rd Officer'
  WHEN 'trainee officer (deck)' THEN 'Deck Cadet' WHEN 'deck cadet' THEN 'Deck Cadet'
  WHEN 'ab' THEN 'Able Seaman' WHEN 'able seaman' THEN 'Able Seaman'
  WHEN 'os' THEN 'Ordinary Seaman' WHEN 'ordinary seaman' THEN 'Ordinary Seaman'
  WHEN 'bosun' THEN 'Bosun' WHEN 'deck boy' THEN 'Deck Boy'
  WHEN 'dpo' THEN 'DPO' WHEN 'sdpo' THEN 'SDPO'
  WHEN 'chief engineer' THEN 'Chief Engineer'
  WHEN 'second engineer' THEN '2nd Engineer' WHEN '2nd engineer' THEN '2nd Engineer'
  WHEN 'third engineer' THEN '3rd Engineer' WHEN '3rd engineer' THEN '3rd Engineer'
  WHEN 'fourth engineer' THEN '4th Engineer' WHEN '4th engineer' THEN '4th Engineer'
  WHEN 'trainee officer (engine)' THEN 'Engine Cadet' WHEN 'engine cadet' THEN 'Engine Cadet'
  WHEN 'motorman' THEN 'Motorman' WHEN 'oiler' THEN 'Oiler' WHEN 'wiper' THEN 'Wiper'
  WHEN 'fitter' THEN 'Fitter' WHEN 'pumpman' THEN 'Pumpman'
  WHEN 'eto' THEN 'ETO' WHEN 'electro-technical officer' THEN 'ETO' WHEN 'electrical officer' THEN 'ETO'
  WHEN 'electrician' THEN 'Electrician'
  WHEN 'chief cook' THEN 'Chief Cook' WHEN 'cook' THEN 'Cook' WHEN '2nd cook' THEN '2nd Cook'
  WHEN 'steward' THEN 'Steward' WHEN 'messman' THEN 'Messman' WHEN 'camp boss' THEN 'Camp Boss'
  ELSE canonical_rank END
WHERE canonical_rank IS NULL;

UPDATE public.rank_taxonomy SET department_label = CASE department
  WHEN 'DECK' THEN 'Deck' WHEN 'ENGINE' THEN 'Engine' WHEN 'ETO' THEN 'Electrical' WHEN 'CATERING' THEN 'Catering' END
WHERE department_label IS NULL;

UPDATE public.rank_taxonomy SET level = CASE
  WHEN canonical_rank IN ('Master','Chief Officer','Chief Engineer','2nd Engineer','SDPO') THEN 'Management'
  WHEN canonical_rank IN ('2nd Officer','3rd Officer','3rd Engineer','4th Engineer','ETO','DPO') THEN 'Operational'
  ELSE 'Support/Rating' END
WHERE level IS NULL;

ALTER TABLE public.smc_assessments
  ADD COLUMN IF NOT EXISTS preflight_context jsonb,
  ADD COLUMN IF NOT EXISTS preflight_source text,
  ADD COLUMN IF NOT EXISTS preflight_confirmed_at timestamptz;

-- Deterministic whole-token resolver. Ambiguous or unsupported -> ok:false.
CREATE OR REPLACE FUNCTION public.resolve_canonical_rank(p_rank text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  n text := ' ' || trim(regexp_replace(lower(coalesce(p_rank,'')), '[^a-z0-9]+', ' ', 'g')) || ' ';
  best_len int; cnt int; r record;
BEGIN
  IF trim(n) = '' THEN RETURN jsonb_build_object('ok', false, 'error_code', 'UNRESOLVED_RANK'); END IF;
  SELECT max(length(p)) INTO best_len FROM (
    SELECT trim(regexp_replace(rank_pattern, '[^a-z0-9]+', ' ', 'g')) p FROM rank_taxonomy WHERE canonical_rank IS NOT NULL
  ) t WHERE position(' ' || p || ' ' in n) > 0;
  IF best_len IS NULL THEN RETURN jsonb_build_object('ok', false, 'error_code', 'UNRESOLVED_RANK'); END IF;
  SELECT count(DISTINCT canonical_rank) INTO cnt FROM rank_taxonomy
   WHERE canonical_rank IS NOT NULL
     AND length(trim(regexp_replace(rank_pattern, '[^a-z0-9]+', ' ', 'g'))) = best_len
     AND position(' ' || trim(regexp_replace(rank_pattern, '[^a-z0-9]+', ' ', 'g')) || ' ' in n) > 0;
  IF cnt <> 1 THEN RETURN jsonb_build_object('ok', false, 'error_code', 'AMBIGUOUS_RANK'); END IF;
  SELECT canonical_rank, department, department_label, rank_group, level INTO r FROM rank_taxonomy
   WHERE canonical_rank IS NOT NULL
     AND length(trim(regexp_replace(rank_pattern, '[^a-z0-9]+', ' ', 'g'))) = best_len
     AND position(' ' || trim(regexp_replace(rank_pattern, '[^a-z0-9]+', ' ', 'g')) || ' ' in n) > 0
   LIMIT 1;
  RETURN jsonb_build_object('ok', true, 'canonical_rank', r.canonical_rank, 'department', r.department_label,
    'department_code', r.department, 'level', r.level, 'rank_group', r.rank_group);
END $$;

-- Single authoritative pre-flight used by self-service SMC and company interviews.
CREATE OR REPLACE FUNCTION public.preflight_assessment(p_assessment_id uuid, p_rank text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid(); a record; camp record; res jsonb; src text; vessel text; input_rank text;
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
    -- Company target rank is authoritative; candidate profile never overrides it.
    src := 'company_campaign'; input_rank := camp.rank_required; vessel := nullif(trim(coalesce(camp.vessel_type,'')), '');
    res := resolve_canonical_rank(input_rank);
  ELSE
    src := 'request'; input_rank := p_rank; res := resolve_canonical_rank(p_rank);
    IF NOT (res->>'ok')::boolean THEN
      src := 'crew_profiles.rank';
      SELECT rank, nullif(trim(coalesce(vessel_type,'')), '') INTO input_rank, vessel FROM crew_profiles WHERE id = uid;
      res := resolve_canonical_rank(input_rank);
    ELSE
      SELECT nullif(trim(coalesce(vessel_type,'')), '') INTO vessel FROM crew_profiles WHERE id = uid;
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

CREATE OR REPLACE FUNCTION public.confirm_preflight(p_assessment_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE smc_assessments SET preflight_confirmed_at = now()
   WHERE id = p_assessment_id AND crew_profile_id = auth.uid() AND preflight_context IS NOT NULL;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error_code', 'PREFLIGHT_REQUIRED'); END IF;
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.report_rank_mismatch(p_assessment_id uuid, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM smc_assessments WHERE id = p_assessment_id AND crew_profile_id = auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'NOT_FOUND');
  END IF;
  INSERT INTO app_events(event_type, message, severity, user_id, metadata)
  VALUES ('rank_mismatch_reported', left(coalesce(p_note,'Candidate reported assessment does not match rank'), 400), 'warning', auth.uid(),
          jsonb_build_object('assessment_id', p_assessment_id,
            'preflight_context', (SELECT preflight_context FROM smc_assessments WHERE id = p_assessment_id)));
  RETURN jsonb_build_object('ok', true);
END $$;

REVOKE ALL ON FUNCTION public.preflight_assessment(uuid, text), public.confirm_preflight(uuid), public.report_rank_mismatch(uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.preflight_assessment(uuid, text), public.confirm_preflight(uuid), public.report_rank_mismatch(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_canonical_rank(text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';