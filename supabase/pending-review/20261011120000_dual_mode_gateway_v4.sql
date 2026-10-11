-- =====================================================================
-- SeaMinds — Dual-Mode Assessment Gateway (Slice 1, v4)
-- STATUS: PENDING INDEPENDENT REVIEW — NOT APPLIED.
-- Deliberately stored outside supabase/migrations/ so no pipeline runs it.
-- After approval, move it to supabase/migrations/ (or apply via the
-- migration tool) — Stage A only. Stage B (permission revoke) is a
-- separate, separately approved step at the bottom (commented out).
--
-- Preserves: R0–R6 scoring (no scoring function touched), scoring weights,
-- completed assessments/certificates, any attempt with work.
-- Excludes all medical / wellness data from evidence snapshots.
-- =====================================================================

-- DEPLOYMENT SEQUENCE (approved order):
--   1. Publish the frontend containing src/lib/assessmentGateway.ts.
--      Before Stage A it falls back to the legacy server paths only
--      when open_assessment_v2 does not exist.
--   2. Apply Stage A (this file). From that moment:
--      - open_assessment_v2 exists, so the client fallback never runs;
--      - stale cached bundles that insert directly get
--        ASSESSMENT_GATEWAY_REQUIRED (refresh prompt) instead of creating
--        an untracked or wrongly-typed assessment;
--      - stale "start over" calls cannot abandon manager interviews.
--   3. After all sessions are on the new bundle, remove the client
--      fallback in a follow-up commit.
--   4. Stage B (grant tidy-up) separately approved.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Additive columns (nullable first; NOT NULL only after backfill)
-- ---------------------------------------------------------------------
ALTER TABLE public.smc_assessments
  ADD COLUMN IF NOT EXISTS assessment_mode   text,
  ADD COLUMN IF NOT EXISTS context_id        text,
  ADD COLUMN IF NOT EXISTS campaign_id       uuid,
  ADD COLUMN IF NOT EXISTS invite_id         uuid,
  ADD COLUMN IF NOT EXISTS evidence_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS cv_version_hash   text;

ALTER TABLE public.interview_invites
  ADD COLUMN IF NOT EXISTS round_2_assessment_id uuid;

COMMENT ON COLUMN public.smc_assessments.assessment_mode IS
  'PROFILE = Sea Profile Score (no CV). CV_BASED = CV evidence included (NOT independently verified). Chosen explicitly at creation; immutable.';
COMMENT ON COLUMN public.smc_assessments.context_id IS
  'self | invite:<invite_id>:r1 | invite:<invite_id>:r2 | legacy_dup:<id>. One in_progress row per (crew, mode, context).';
COMMENT ON COLUMN public.smc_assessments.scoring_tier IS
  'Legacy label derived from assessment_mode (CV_BASED -> CV_VERIFIED). UI must show "CV-Based — CV Evidence Included".';

-- ---------------------------------------------------------------------
-- 2. Historical backfill (no score / certificate / status changes)
-- ---------------------------------------------------------------------
UPDATE public.smc_assessments
   SET assessment_mode = CASE WHEN scoring_tier = 'CV_VERIFIED' THEN 'CV_BASED' ELSE 'PROFILE' END
 WHERE assessment_mode IS NULL;

-- Link invite / campaign from existing interview records
UPDATE public.smc_assessments a
   SET invite_id = ip.invite_id, campaign_id = ip.campaign_id
  FROM public.interview_progress ip
 WHERE ip.assessment_id = a.id AND a.invite_id IS NULL;

UPDATE public.smc_assessments a
   SET invite_id = i.id, campaign_id = i.campaign_id
  FROM public.interview_invites i
 WHERE i.assessment_id = a.id AND a.invite_id IS NULL;

UPDATE public.smc_assessments
   SET context_id = CASE
         WHEN invite_id IS NOT NULL AND parent_assessment_id IS NOT NULL THEN 'invite:' || invite_id || ':r2'
         WHEN invite_id IS NOT NULL THEN 'invite:' || invite_id || ':r1'
         WHEN parent_assessment_id IS NOT NULL THEN 'round_2:' || parent_assessment_id
         ELSE 'self' END
 WHERE context_id IS NULL;

-- Historical rows are tagged, never given a fabricated snapshot
UPDATE public.smc_assessments
   SET evidence_snapshot = jsonb_build_object('snapshot_type', 'historical_legacy',
                                              'note', 'Created before evidence snapshots existed')
 WHERE evidence_snapshot IS NULL;

ALTER TABLE public.smc_assessments
  ALTER COLUMN assessment_mode SET DEFAULT 'PROFILE',
  ALTER COLUMN assessment_mode SET NOT NULL,
  ALTER COLUMN context_id SET DEFAULT 'self',
  ALTER COLUMN context_id SET NOT NULL;

ALTER TABLE public.smc_assessments
  ADD CONSTRAINT smc_assessments_mode_chk CHECK (assessment_mode IN ('PROFILE','CV_BASED'));

-- ---------------------------------------------------------------------
-- 3. Work-aware duplicate reconciliation
--    Rule: a duplicate in_progress row is abandoned ONLY if it has no
--    work of any kind. Rows with work are preserved by moving them to a
--    unique legacy context (status untouched) and logged for review.
-- ---------------------------------------------------------------------
CREATE TEMP TABLE _sm_work ON COMMIT DROP AS
SELECT a.id, a.crew_profile_id, a.assessment_mode, a.context_id, a.started_at, a.current_step,
       (SELECT count(*) FROM public.answer_ledger l WHERE l.assessment_id = a.id)            AS ledger_n,
       EXISTS (SELECT 1 FROM public.issued_papers p WHERE p.assessment_id = a.id)            AS has_paper,
       EXISTS (SELECT 1 FROM public.assessment_checkpoints c WHERE c.assessment_id = a.id)   AS has_ckpt,
       EXISTS (SELECT 1 FROM public.scoring_jobs s WHERE s.assessment_id = a.id)             AS has_job,
       EXISTS (SELECT 1 FROM public.answer_scoring_jobs j WHERE j.assessment_id = a.id)      AS has_ans_job,
       EXISTS (SELECT 1 FROM public.interview_progress ip WHERE ip.assessment_id = a.id
                 AND (ip.question_index > 0 OR coalesce(jsonb_typeof(ip.answers),'null') NOT IN ('null')
                      AND ip.answers::text NOT IN ('[]','{}')))                              AS has_iv_work,
       (a.preflight_confirmed_at IS NOT NULL)                                                AS has_preflight
  FROM public.smc_assessments a
 WHERE a.status = 'in_progress';

ALTER TABLE _sm_work ADD COLUMN has_work boolean;
UPDATE _sm_work SET has_work = (ledger_n > 0 OR has_paper OR has_ckpt OR has_job OR has_ans_job
                                OR has_iv_work OR has_preflight OR coalesce(current_step,1) > 1);

CREATE TEMP TABLE _sm_rank ON COMMIT DROP AS
SELECT w.*, row_number() OVER (
         PARTITION BY crew_profile_id, assessment_mode, context_id
         ORDER BY has_work DESC, ledger_n DESC, has_paper DESC, has_ckpt DESC,
                  coalesce(current_step,1) DESC, started_at DESC, id) AS rn
  FROM _sm_work w;

-- Audit trail first
INSERT INTO public.app_events(event_type, message, severity, user_id, metadata)
SELECT 'dual_mode_reconcile',
       CASE WHEN has_work THEN 'duplicate with work preserved under legacy context'
            ELSE 'empty duplicate abandoned' END,
       'info', crew_profile_id,
       jsonb_build_object('assessment_id', id, 'mode', assessment_mode, 'context', context_id,
                          'ledger_n', ledger_n, 'has_paper', has_paper, 'has_ckpt', has_ckpt,
                          'has_job', has_job, 'has_iv_work', has_iv_work)
  FROM _sm_rank WHERE rn > 1;

-- Empty duplicates only
UPDATE public.smc_assessments a SET status = 'abandoned'
  FROM _sm_rank r WHERE r.id = a.id AND r.rn > 1 AND NOT r.has_work;

-- Duplicates with work: preserved, isolated, untouched otherwise
UPDATE public.smc_assessments a SET context_id = 'legacy_dup:' || a.id
  FROM _sm_rank r WHERE r.id = a.id AND r.rn > 1 AND r.has_work;

CREATE UNIQUE INDEX IF NOT EXISTS uq_smc_active_crew_mode_context
  ON public.smc_assessments (crew_profile_id, assessment_mode, context_id)
  WHERE status = 'in_progress';

-- ---------------------------------------------------------------------
-- 4. Evidence snapshot builder (internal; no medical / wellness fields)
-- ---------------------------------------------------------------------
--    The snapshot IS the immutable versioned evidence record: it copies
--    approved professional fields only (whitelists below). Never read:
--    crew_cv_data.medical, crew_cv_data.education, passport/DOB/contact,
--    chat, mood or any wellness table.
CREATE OR REPLACE FUNCTION public.build_evidence_snapshot(
  p_uid uuid, p_mode text, p_target_rank text, p_target_vessel text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p record; cv record; v_rank jsonb; v_fam jsonb; v_claims jsonb; v_cv jsonb := NULL;
  v_certs jsonb := '[]'::jsonb; v_sea jsonb := '[]'::jsonb;
  -- Approved professional claim keys (competence declarations only)
  c_claim_keys text[] := ARRAY[
    'ecdis_experience','ecdis_types','psc_experience','rightship_experience','sire_experience',
    'hv_certified','watchkeeping_lookout','helmsman','cargo_ops_watch','ums_experience',
    'mooring_experience','propulsion_experience','dp_qualification','dp_vessel_experience',
    'haccp_trained','multicultural_menus','hazardous_area_ex','automation_systems',
    'crew_size_cooked','tanker_deck_ops','provisioning_budget','lashing_securing','cargo_pumping_systems'];
BEGIN
  SELECT rank, vessel_type, preferred_vessel_types, years_at_sea, total_sea_service_band,
         years_in_rank_band, contracts_in_rank_band, quick_profile_completed_at
    INTO p FROM crew_profiles WHERE id = p_uid;

  v_rank := resolve_canonical_rank(coalesce(p_target_rank, p.rank));

  SELECT coalesce(jsonb_agg(jsonb_build_object('family', vessel_family, 'sea_time_band', sea_time_band)
                            ORDER BY vessel_family), '[]'::jsonb)
    INTO v_fam FROM crew_vessel_experience WHERE crew_id = p_uid;

  SELECT coalesce(jsonb_object_agg(claim_key, value), '{}'::jsonb)
    INTO v_claims FROM crew_claims WHERE crew_id = p_uid AND claim_key = ANY (c_claim_keys);

  IF p_mode = 'CV_BASED' THEN
    SELECT certificates, sea_service, updated_at INTO cv FROM crew_cv_data WHERE user_id = p_uid
     ORDER BY updated_at DESC NULLS LAST LIMIT 1;
    IF FOUND THEN
      -- Professional certificates: name/authority/dates only (no numbers, no medical)
      IF jsonb_typeof(cv.certificates) = 'array' THEN
        SELECT coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                 'name',              left(e->>'name', 200),
                 'issuing_authority', left(coalesce(e->>'issuing_authority', e->>'issuingAuthority'), 200),
                 'issue_date',        left(coalesce(e->>'issue_date', e->>'issueDate'), 40),
                 'expiry_date',       left(coalesce(e->>'expiry_date', e->>'expiryDate'), 40)))), '[]'::jsonb)
          INTO v_certs FROM jsonb_array_elements(cv.certificates) e
         WHERE jsonb_typeof(e) = 'object';
      END IF;
      -- Sea service: vessel/rank/company/dates/technical type only
      IF jsonb_typeof(cv.sea_service) = 'array' THEN
        SELECT coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                 -- explicit mapping: snake_case (new parser) OR camelCase (existing records)
                 'vessel_name', left(coalesce(e->>'vessel_name', e->>'vesselName'), 200),
                 'vessel_type', left(coalesce(e->>'vessel_type', e->>'vesselType'), 100),
                 'flag',        left(coalesce(e->>'flag', e->>'flagState'), 100),
                 'grt',         left(coalesce(e->>'grt', e->>'grtDwt'), 40),
                 'rank',        left(coalesce(e->>'rank', e->>'rankOnBoard'), 100),
                 'company',     left(e->>'company', 200),
                 'sign_on',     left(coalesce(e->>'sign_on', e->>'fromDate'), 40),
                 'sign_off',    left(coalesce(e->>'sign_off', e->>'toDate'), 40),
                 'engine_type', left(coalesce(e->>'engine_type', e->>'engineType'), 100),
                 'cargo_type',  left(coalesce(e->>'cargo_type', e->>'cargoType'), 100)))), '[]'::jsonb)
          INTO v_sea FROM jsonb_array_elements(cv.sea_service) e
         WHERE jsonb_typeof(e) = 'object';
      END IF;
      v_cv := jsonb_build_object(
        'cv_version_hash', md5(v_certs::text || '|' || v_sea::text),
        'cv_updated_at', cv.updated_at,
        'certificates', v_certs,
        'sea_service', v_sea,
        'verification', 'not_independently_verified');
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'snapshot_type', 'v1',
    'captured_at', now(),
    'mode', p_mode,
    'profile_rank_input', p.rank,
    'target', CASE WHEN p_target_rank IS NULL THEN NULL
                   ELSE jsonb_build_object('rank_input', p_target_rank, 'vessel_type', p_target_vessel) END,
    'rank', v_rank,
    'profile', jsonb_build_object(
       'vessel_type', p.vessel_type, 'preferred_vessel_types', p.preferred_vessel_types,
       'years_at_sea', p.years_at_sea, 'total_sea_service_band', p.total_sea_service_band,
       'years_in_rank_band', p.years_in_rank_band, 'contracts_in_rank_band', p.contracts_in_rank_band,
       'quick_profile_completed_at', p.quick_profile_completed_at),
    'vessel_experience', v_fam,
    'claims', v_claims,
    'cv', v_cv);
END $$;
REVOKE ALL ON FUNCTION public.build_evidence_snapshot(uuid, text, text, text) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. Triggers
-- ---------------------------------------------------------------------
-- 5a. Insert sanitizer: stop overwriting the trusted gateway's
--     scoring_version. After Stage A, ANY direct client insert (e.g. a
--     stale cached browser bundle) is rejected so nothing can bypass the
--     gateway or turn a manager interview into a self PROFILE row. This
--     enforces the gateway immediately; Stage B only tidies grants.
CREATE OR REPLACE FUNCTION public.smc_assessments_sanitize_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('authenticated','anon') THEN
    RAISE EXCEPTION 'ASSESSMENT_GATEWAY_REQUIRED: please refresh the SeaMinds app'
      USING ERRCODE = '42501';
  END IF;
  NEW.status := 'in_progress';
  NEW.current_step := 1;
  NEW.doc_upload_status := 'pending';
  NEW.technical_score := NULL; NEW.english_score := NULL; NEW.experience_score := NULL;
  NEW.behavioural_score := NULL; NEW.wellness_score := NULL; NEW.judgment_score := NULL;
  NEW.overall_score := NULL; NEW.score_band := NULL; NEW.certificate_id := NULL;
  NEW.recommendation := NULL; NEW.dimension_scores := NULL; NEW.red_flags := '[]'::jsonb;
  NEW.report := NULL; NEW.completed_at := NULL;
  NEW.scoring_version := coalesce(NEW.scoring_version, 'v1.1');
  RETURN NEW;
END $$;

-- 5b. Replace CV-existence inference: tier strictly follows explicit mode.
CREATE OR REPLACE FUNCTION public.set_assessment_scoring_tier()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.scoring_tier := CASE WHEN NEW.assessment_mode = 'CV_BASED' THEN 'CV_VERIFIED' ELSE 'QUICK_PROFILE' END;
  IF TG_OP = 'INSERT' THEN
    NEW.assessment_round := CASE WHEN NEW.parent_assessment_id IS NOT NULL THEN 2 ELSE 1 END;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_set_assessment_scoring_tier ON public.smc_assessments;
CREATE TRIGGER trg_set_assessment_scoring_tier
  BEFORE INSERT OR UPDATE OF assessment_mode, scoring_tier ON public.smc_assessments
  FOR EACH ROW EXECUTE FUNCTION public.set_assessment_scoring_tier();

-- 5c. Immutability (findings 4 & 5): clients can never change these, in any
--     state including NULL. Trusted roles may only fill a NULL snapshot.
CREATE OR REPLACE FUNCTION public.protect_assessment_immutability()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('authenticated','anon') THEN
    IF NEW.assessment_mode      IS DISTINCT FROM OLD.assessment_mode
    OR NEW.context_id           IS DISTINCT FROM OLD.context_id
    OR NEW.campaign_id          IS DISTINCT FROM OLD.campaign_id
    OR NEW.invite_id            IS DISTINCT FROM OLD.invite_id
    OR NEW.parent_assessment_id IS DISTINCT FROM OLD.parent_assessment_id
    OR NEW.assessment_round     IS DISTINCT FROM OLD.assessment_round
    OR NEW.evidence_snapshot    IS DISTINCT FROM OLD.evidence_snapshot
    OR NEW.cv_version_hash      IS DISTINCT FROM OLD.cv_version_hash
    OR NEW.scoring_tier         IS DISTINCT FROM OLD.scoring_tier
    OR NEW.scoring_version      IS DISTINCT FROM OLD.scoring_version
    OR NEW.crew_profile_id      IS DISTINCT FROM OLD.crew_profile_id THEN
      RAISE EXCEPTION 'IMMUTABLE_ASSESSMENT_FIELD' USING ERRCODE = '42501';
    END IF;
    -- Stale clients' blanket "start over" must never abandon a manager
    -- interview (or a preserved legacy duplicate) — only own self rows.
    IF NEW.status = 'abandoned' AND OLD.status IS DISTINCT FROM 'abandoned' AND OLD.context_id <> 'self' THEN
      RAISE EXCEPTION 'CANNOT_ABANDON_MANAGED_ASSESSMENT' USING ERRCODE = '42501';
    END IF;
  ELSIF OLD.evidence_snapshot IS NOT NULL
    AND NEW.evidence_snapshot IS DISTINCT FROM OLD.evidence_snapshot THEN
    RAISE EXCEPTION 'EVIDENCE_SNAPSHOT_FROZEN' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_protect_assessment_immutability ON public.smc_assessments;
CREATE TRIGGER trg_protect_assessment_immutability
  BEFORE UPDATE ON public.smc_assessments
  FOR EACH ROW EXECUTE FUNCTION public.protect_assessment_immutability();

-- ---------------------------------------------------------------------
-- 6. Authoritative gateway
--    Does NOT confirm preflight: preflight_confirmed_at stays NULL; the
--    candidate must still review the rank via preflight_assessment +
--    confirm_preflight before issue_paper (R1 preserved).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.open_assessment_v2(
  p_mode text, p_invite_id uuid DEFAULT NULL, p_restart boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    -- Lock the invite first; authorize; then derive context
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

    -- Round 2 ONLY with an explicit manager CV request + completed Round 1
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

    -- Respect an EXISTING linked assessment for this round: resume it, or
    -- refuse to create a replacement. Never relink or duplicate history.
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

    -- A new attempt needs an open campaign; resuming an existing one does not
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

  -- Genuinely NEW assessment only: validate the CURRENT rank here. An existing
  -- active attempt resumed above keeps its frozen snapshot rank, even if the
  -- profile was edited since. Preflight confirmation remains mandatory.
  -- Canonical rank (server taxonomy) — manager target rank for invites
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
      -- Fill an empty progress link only; never overwrite an existing one
      INSERT INTO interview_progress (invite_id, crew_id, assessment_id, campaign_id)
      VALUES (v_invite, v_uid, v_id, v_campaign)
      ON CONFLICT (crew_id, invite_id) DO UPDATE
        SET assessment_id = EXCLUDED.assessment_id WHERE interview_progress.assessment_id IS NULL;
    ELSE
      -- Round 1 link (assessment_id) is never overwritten; Round 2 set once
      UPDATE interview_invites SET round_2_assessment_id = v_id
       WHERE id = v_invite AND round_2_assessment_id IS NULL;
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'action', 'start', 'assessment_id', v_id,
                            'mode', v_mode, 'context_id', v_ctx, 'round', v_round);
END $$;
REVOKE ALL ON FUNCTION public.open_assessment_v2(text, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_assessment_v2(text, uuid, boolean) TO authenticated;

-- Legacy zero-arg caller: no more 24h auto-abandon of work; delegates.
CREATE OR REPLACE FUNCTION public.start_or_resume_assessment()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN public.open_assessment_v2('PROFILE', NULL, false);
END $$;
REVOKE ALL ON FUNCTION public.start_or_resume_assessment() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_or_resume_assessment() TO authenticated;

-- ---------------------------------------------------------------------
-- 7. Preflight uses the FROZEN snapshot rank (finding 1). Still never
--    auto-confirms; candidate confirmation remains mandatory.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.preflight_assessment(p_assessment_id uuid, p_rank text DEFAULT NULL::text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  uid uuid := auth.uid(); a record; camp record; res jsonb; req jsonb; src text; vessel text; input_rank text;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error_code', 'AUTH_REQUIRED'); END IF;
  SELECT id, crew_profile_id, evidence_snapshot INTO a FROM smc_assessments WHERE id = p_assessment_id;
  IF a.id IS NULL OR a.crew_profile_id <> uid THEN RETURN jsonb_build_object('ok', false, 'error_code', 'NOT_FOUND'); END IF;

  IF a.evidence_snapshot->>'snapshot_type' = 'v1' THEN
    -- Frozen at creation for BOTH self and manager assessments. A later
    -- campaign or profile edit can never change the authoritative rank.
    src := CASE WHEN a.evidence_snapshot ? 'target' AND a.evidence_snapshot->'target'->>'rank_input' IS NOT NULL
                THEN 'evidence_snapshot.company_target' ELSE 'evidence_snapshot.profile' END;
    input_rank := coalesce(a.evidence_snapshot->'target'->>'rank_input', a.evidence_snapshot->>'profile_rank_input');
    vessel := nullif(trim(coalesce(a.evidence_snapshot->'target'->>'vessel_type',
                                   a.evidence_snapshot->'profile'->>'vessel_type', '')), '');
  ELSE
    -- Legacy rows without a snapshot keep the previous behaviour unchanged
    SELECT c.rank_required, c.vessel_type INTO camp
      FROM interview_progress ip JOIN interview_campaigns c ON c.id = ip.campaign_id
     WHERE ip.assessment_id = p_assessment_id LIMIT 1;
    IF NOT FOUND THEN
      SELECT c.rank_required, c.vessel_type INTO camp
        FROM interview_invites i JOIN interview_campaigns c ON c.id = i.campaign_id
       WHERE i.assessment_id = p_assessment_id LIMIT 1;
    END IF;
    IF FOUND THEN
      src := 'company_campaign'; input_rank := camp.rank_required; vessel := nullif(trim(coalesce(camp.vessel_type,'')), '');
    ELSE
      src := 'crew_profiles.rank';
      SELECT rank, nullif(trim(coalesce(vessel_type,'')), '') INTO input_rank, vessel FROM crew_profiles WHERE id = uid;
    END IF;
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
END $function$;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- STAGE B — PERMISSION TRANSITION (DO NOT RUN until every deployed client
-- uses open_assessment_v2 and this step is separately approved)
-- =====================================================================
-- DROP POLICY IF EXISTS crew_insert_assessment ON public.smc_assessments;
-- REVOKE INSERT ON public.smc_assessments FROM anon, authenticated;
-- NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- STALE-CLIENT IMPACT (honest): after Stage A, any browser still running
-- an old cached bundle that inserts directly is REJECTED with
-- ASSESSMENT_GATEWAY_REQUIRED. This is a real, brief disruption for those
-- users. Recovery path: the app shows "Please refresh the SeaMinds app";
-- the network-only /version.json check offers a one-tap Refresh; after
-- refresh the new bundle resumes the same in-progress assessment.
--
-- RECOVERY IF STAGE A FAILS DURING APPLY: the whole file runs in one
-- transaction (BEGIN ... COMMIT). Any error rolls back everything; the
-- database stays exactly as before. Nothing else to do.
--
-- RECOVERY IF A PROBLEM APPEARS AFTER COMMIT (forward-fix only):
--   * NEVER DROP open_assessment_v2 — start_or_resume_assessment()
--     delegates to it; dropping it breaks every assessment start.
--   * Never drop the new columns, index or triggers; never delete or
--     rewrite assessment rows, answers, papers, checkpoints or scores.
--   * Fix by CREATE OR REPLACE of the faulty function in place
--     (open_assessment_v2, build_evidence_snapshot, preflight_assessment,
--     or a trigger function), via a new reviewed migration.
--   * If direct-insert rejection blocks users unexpectedly, replace only
--     smc_assessments_sanitize_insert() to remove the RAISE (keep the
--     score-nulling lines). This restores old-bundle starts.
--   * Do NOT re-grant client INSERT once Stage B has run.
--
-- LAST RESORT: Cloud → Database → Backups → "Restore to this backup"
-- (daily snapshot, ~14 days retained). Restores schema + data to that
-- day; anything created after the snapshot is LOST, storage files are not
-- included. Confirm a snapshot from the same day exists BEFORE applying.
-- =====================================================================
