
-- R2: governed inventory, versioned blueprints, immutable issued papers (server-side keys only)
CREATE TABLE public.assessment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_key text NOT NULL,
  question_version int NOT NULL DEFAULT 1,
  question_type text NOT NULL CHECK (question_type IN ('mcq','scenario','behavioural','professional')),
  rank_scope text[] NOT NULL DEFAULT '{}',
  legacy_rank_group text,
  department text,
  level text,
  vessel_scope text[] NOT NULL DEFAULT '{General}',
  domain text,
  cognitive_level text,
  prompt jsonb NOT NULL,
  answer_key jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_type text NOT NULL,
  source_reference text,
  source_version text,
  approval_status text NOT NULL DEFAULT 'DRAFT' CHECK (approval_status IN ('DRAFT','LEGACY_REVIEW_REQUIRED','TEST_ONLY','SME_APPROVED','RETIRED')),
  approval_basis text,
  reviewed_by text,
  reviewed_at timestamptz,
  is_active boolean NOT NULL DEFAULT false,
  exposure_count int NOT NULL DEFAULT 0,
  legacy_question_bank_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_key, question_version),
  CONSTRAINT sme_requires_review CHECK (approval_status <> 'SME_APPROVED' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND approval_basis IS NOT NULL AND source_reference IS NOT NULL))
);
REVOKE ALL ON public.assessment_items FROM anon, authenticated;
GRANT SELECT ON public.assessment_items TO authenticated;
GRANT ALL ON public.assessment_items TO service_role;
ALTER TABLE public.assessment_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read inventory" ON public.assessment_items FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE TABLE public.assessment_blueprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_rank text NOT NULL,
  department text NOT NULL,
  level text NOT NULL,
  vessel_context text NOT NULL DEFAULT 'General',
  blueprint_version int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','ACTIVE','RETIRED')),
  is_test boolean NOT NULL DEFAULT false,
  requirements jsonb NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (canonical_rank, department, level, vessel_context, blueprint_version, is_test)
);
GRANT SELECT ON public.assessment_blueprints TO authenticated;
GRANT ALL ON public.assessment_blueprints TO service_role;
ALTER TABLE public.assessment_blueprints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read blueprints" ON public.assessment_blueprints FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE TABLE public.issued_papers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.smc_assessments(id),
  crew_profile_id uuid NOT NULL,
  paper_version int NOT NULL DEFAULT 1,
  blueprint_id uuid NOT NULL REFERENCES public.assessment_blueprints(id),
  blueprint_version int NOT NULL,
  is_test boolean NOT NULL DEFAULT false,
  context jsonb NOT NULL,
  items jsonb NOT NULL,
  status text NOT NULL DEFAULT 'ISSUED' CHECK (status IN ('ISSUED','COMPLETED','SUPERSEDED_SYSTEM_ERROR')),
  issued_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assessment_id, paper_version)
);
CREATE UNIQUE INDEX issued_papers_one_live ON public.issued_papers(assessment_id) WHERE status = 'ISSUED';
GRANT SELECT ON public.issued_papers TO authenticated;
GRANT ALL ON public.issued_papers TO service_role;
ALTER TABLE public.issued_papers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Candidate reads own paper" ON public.issued_papers FOR SELECT TO authenticated USING (crew_profile_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TABLE public.issued_paper_keys (
  paper_id uuid NOT NULL REFERENCES public.issued_papers(id),
  paper_item_id text NOT NULL,
  item_id uuid NOT NULL REFERENCES public.assessment_items(id),
  item_version int NOT NULL,
  answer_key jsonb NOT NULL,
  PRIMARY KEY (paper_id, paper_item_id)
);
REVOKE ALL ON public.issued_paper_keys FROM anon, authenticated;
GRANT ALL ON public.issued_paper_keys TO service_role;
ALTER TABLE public.issued_paper_keys ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.paper_item_responses (
  paper_id uuid NOT NULL REFERENCES public.issued_papers(id),
  paper_item_id text NOT NULL,
  answer text,
  is_correct boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (paper_id, paper_item_id)
);
REVOKE ALL ON public.paper_item_responses FROM anon, authenticated;
GRANT ALL ON public.paper_item_responses TO service_role;
ALTER TABLE public.paper_item_responses ENABLE ROW LEVEL SECURITY;

-- Immutability guards
CREATE OR REPLACE FUNCTION public.protect_issued_paper() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'issued papers are immutable'; END IF;
  IF NEW.items IS DISTINCT FROM OLD.items OR NEW.blueprint_id IS DISTINCT FROM OLD.blueprint_id
     OR NEW.blueprint_version IS DISTINCT FROM OLD.blueprint_version OR NEW.paper_version IS DISTINCT FROM OLD.paper_version
     OR NEW.assessment_id IS DISTINCT FROM OLD.assessment_id OR NEW.issued_at IS DISTINCT FROM OLD.issued_at
     OR NEW.context IS DISTINCT FROM OLD.context OR NEW.crew_profile_id IS DISTINCT FROM OLD.crew_profile_id OR NEW.is_test IS DISTINCT FROM OLD.is_test THEN
    RAISE EXCEPTION 'issued paper snapshot is immutable';
  END IF;
  IF OLD.status <> 'ISSUED' AND NEW.status IS DISTINCT FROM OLD.status THEN RAISE EXCEPTION 'final paper status cannot change'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_protect_issued_paper BEFORE UPDATE OR DELETE ON public.issued_papers FOR EACH ROW EXECUTE FUNCTION public.protect_issued_paper();

CREATE OR REPLACE FUNCTION public.protect_paper_keys() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'issued paper keys/responses are immutable'; END $$;
CREATE TRIGGER trg_protect_paper_keys BEFORE UPDATE OR DELETE ON public.issued_paper_keys FOR EACH ROW EXECUTE FUNCTION public.protect_paper_keys();
CREATE TRIGGER trg_protect_paper_responses BEFORE UPDATE OR DELETE ON public.paper_item_responses FOR EACH ROW EXECUTE FUNCTION public.protect_paper_keys();

-- Legacy import: preserved, never labelled SME approved, not production eligible
INSERT INTO public.assessment_items (item_key, question_version, question_type, legacy_rank_group, vessel_scope, domain, cognitive_level, prompt, answer_key, source_type, source_reference, approval_status, approval_basis, is_active, exposure_count, legacy_question_bank_id)
SELECT 'QB-' || q.id::text, 1, 'mcq', q.rank_group, ARRAY[coalesce(q.vessel_type,'General')], q.domain, q.difficulty,
       jsonb_build_object('question', q.question, 'options', q.options),
       jsonb_build_object('correct_index', q.correct_index, 'correct_letter', q.correct_letter, 'explanation', q.explanation, 'regulation', q.regulation),
       'LEGACY_QUESTION_BANK', q.regulation, 'LEGACY_REVIEW_REQUIRED', 'Imported from legacy question_bank; provenance and correctness not SME-verified',
       coalesce(q.active, false), coalesce(q.times_used, 0), q.id
FROM public.question_bank q
WHERE jsonb_typeof(q.options) = 'array' AND q.correct_index IS NOT NULL;

-- Server-side paper issuance (no LLM). Returns sanitized snapshot only.
CREATE OR REPLACE FUNCTION public.issue_paper(p_assessment_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid(); a record; ctx jsonb; bp record; req jsonb; need int; got int;
  shortfalls jsonb := '[]'::jsonb; picked uuid[] := '{}'; it record; n int; perm int[]; opts jsonb; newc int;
  pid uuid := gen_random_uuid(); disp jsonb := '[]'::jsonb; keys jsonb := '[]'::jsonb; k int := 0; pi text;
  admin boolean; rgroup text; existing record; vctx text;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error_code', 'AUTH_REQUIRED'); END IF;
  SELECT id, crew_profile_id, preflight_context, preflight_confirmed_at INTO a FROM smc_assessments WHERE id = p_assessment_id FOR UPDATE;
  IF a.id IS NULL OR a.crew_profile_id <> uid THEN RETURN jsonb_build_object('ok', false, 'error_code', 'NOT_FOUND'); END IF;
  IF a.preflight_confirmed_at IS NULL OR a.preflight_context IS NULL OR NOT coalesce((a.preflight_context->>'ok')::boolean, false) THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'PREFLIGHT_REQUIRED');
  END IF;
  ctx := a.preflight_context;

  SELECT * INTO existing FROM issued_papers WHERE assessment_id = p_assessment_id AND status = 'ISSUED';
  IF existing.id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'paper_id', existing.id, 'paper_version', existing.paper_version, 'blueprint_version', existing.blueprint_version,
      'is_test', existing.is_test, 'context', existing.context, 'items', existing.items, 'issued_at', existing.issued_at);
  END IF;

  admin := is_admin(uid);
  vctx := coalesce(ctx->>'vessel_context', 'General');
  SELECT * INTO bp FROM assessment_blueprints b
   WHERE b.status = 'ACTIVE' AND b.canonical_rank = ctx->>'canonical_rank' AND b.department = ctx->>'department' AND b.level = ctx->>'level'
     AND b.vessel_context IN (vctx, 'General') AND (NOT b.is_test OR admin)
   ORDER BY b.is_test ASC, (b.vessel_context = vctx) DESC, b.blueprint_version DESC LIMIT 1;
  IF bp.id IS NULL THEN
    INSERT INTO app_events(event_type, message, severity, user_id, metadata)
    VALUES ('paper_not_ready', 'no active blueprint', 'warning', uid, jsonb_build_object('assessment_id', p_assessment_id, 'context', ctx));
    RETURN jsonb_build_object('ok', false, 'error_code', 'PAPER_NOT_READY', 'reason', 'NO_ACTIVE_BLUEPRINT', 'context', ctx);
  END IF;

  rgroup := CASE WHEN ctx->>'rank_group' LIKE '%OFFICER' THEN 'OFFICER' ELSE 'RATING' END;
  FOR req IN SELECT * FROM jsonb_array_elements(bp.requirements) LOOP
    need := coalesce((req->>'count')::int, 0); got := 0;
    FOR it IN
      SELECT i.* FROM assessment_items i
       WHERE i.is_active AND NOT (i.id = ANY(picked))
         AND i.question_type = req->>'item_type'
         AND (req->>'domain' IS NULL OR i.domain = req->>'domain')
         AND (req->>'cognitive_level' IS NULL OR i.cognitive_level = req->>'cognitive_level')
         AND (i.vessel_scope && ARRAY[vctx, 'General'])
         AND (
           (i.approval_status = 'SME_APPROVED' AND (ctx->>'canonical_rank') = ANY(i.rank_scope))
           OR (bp.is_test AND i.approval_status IN ('TEST_ONLY','LEGACY_REVIEW_REQUIRED')
               AND ((ctx->>'canonical_rank') = ANY(i.rank_scope) OR (i.rank_scope = '{}' AND i.legacy_rank_group = rgroup)))
         )
       ORDER BY i.exposure_count ASC, random() LIMIT need
    LOOP
      picked := picked || it.id; got := got + 1; k := k + 1; pi := 'p' || k;
      IF it.question_type = 'mcq' THEN
        n := jsonb_array_length(it.prompt->'options');
        SELECT array_agg(g ORDER BY random()) INTO perm FROM generate_series(0, n - 1) g;
        SELECT jsonb_agg(it.prompt->'options'->perm[x] ORDER BY x) INTO opts FROM generate_series(1, n) x;
        newc := array_position(perm, (it.answer_key->>'correct_index')::int) - 1;
        disp := disp || jsonb_build_object('paper_item_id', pi, 'type', 'mcq', 'domain', it.domain, 'question', it.prompt->>'question', 'options', opts);
        keys := keys || jsonb_build_object('pi', pi, 'item', it.id, 'v', it.question_version,
          'key', jsonb_build_object('correct_index', newc, 'correct_letter', chr(65 + newc), 'explanation', it.answer_key->>'explanation', 'regulation', it.answer_key->>'regulation', 'option_order', to_jsonb(perm)));
      ELSE
        disp := disp || jsonb_strip_nulls(jsonb_build_object('paper_item_id', pi, 'type', it.question_type, 'domain', it.domain, 'question', it.prompt->>'question',
          'situation', it.prompt->>'situation', 'category', it.prompt->>'category', 'prompt_text', it.prompt->>'prompt_text', 'time_seconds', (it.prompt->>'time_seconds')::int));
        keys := keys || jsonb_build_object('pi', pi, 'item', it.id, 'v', it.question_version, 'key', it.answer_key);
      END IF;
    END LOOP;
    IF got < need THEN shortfalls := shortfalls || jsonb_build_object('requirement', req, 'available', got, 'required', need); END IF;
  END LOOP;

  IF jsonb_array_length(shortfalls) > 0 OR k = 0 THEN
    INSERT INTO app_events(event_type, message, severity, user_id, metadata)
    VALUES ('blueprint_incomplete', 'inventory does not satisfy blueprint', 'warning', uid,
            jsonb_build_object('assessment_id', p_assessment_id, 'blueprint_id', bp.id, 'shortfalls', shortfalls));
    RETURN jsonb_build_object('ok', false, 'error_code', 'BLUEPRINT_INCOMPLETE', 'blueprint_version', bp.blueprint_version, 'shortfalls', shortfalls);
  END IF;

  -- Order: mcq, scenario, behavioural/professional (stable within type)
  SELECT jsonb_agg(e ORDER BY CASE e->>'type' WHEN 'mcq' THEN 1 WHEN 'scenario' THEN 2 ELSE 3 END, o) INTO disp
    FROM jsonb_array_elements(disp) WITH ORDINALITY t(e, o);

  INSERT INTO issued_papers(id, assessment_id, crew_profile_id, blueprint_id, blueprint_version, is_test, context, items)
  VALUES (pid, p_assessment_id, uid, bp.id, bp.blueprint_version, bp.is_test, ctx, disp);
  INSERT INTO issued_paper_keys(paper_id, paper_item_id, item_id, item_version, answer_key)
  SELECT pid, e->>'pi', (e->>'item')::uuid, (e->>'v')::int, e->'key' FROM jsonb_array_elements(keys) e;
  UPDATE assessment_items SET exposure_count = exposure_count + 1 WHERE id = ANY(picked);

  RETURN jsonb_build_object('ok', true, 'paper_id', pid, 'paper_version', 1, 'blueprint_version', bp.blueprint_version,
    'is_test', bp.is_test, 'context', ctx, 'items', disp, 'issued_at', now());
END $$;
REVOKE ALL ON FUNCTION public.issue_paper(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.issue_paper(uuid) TO authenticated;

-- Admin-only TEST blueprint (never visible to non-admin candidates)
INSERT INTO public.assessment_blueprints (canonical_rank, department, level, vessel_context, blueprint_version, status, is_test, requirements, notes)
VALUES ('Master', 'Deck', 'Management', 'PSV', 1, 'ACTIVE', true, '[{"item_type":"mcq","count":10}]'::jsonb,
        'TEST ONLY: admin-only, draws LEGACY_REVIEW_REQUIRED items. Not production content.');
NOTIFY pgrst, 'reload schema';
