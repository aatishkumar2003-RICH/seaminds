-- Adaptive crew training: curated catalog, per-crew assignments (training memory), server-side selection & grading.
CREATE TABLE public.training_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  summary text NOT NULL,
  key_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  media_url text,
  media_label text,
  departments text[] NOT NULL DEFAULT '{}',
  vessel_families text[] NOT NULL DEFAULT '{}',
  levels text[] NOT NULL DEFAULT '{}',
  domains text[] NOT NULL DEFAULT '{}',
  trading_areas text[] NOT NULL DEFAULT '{}',
  concepts text[] NOT NULL DEFAULT '{}',
  quiz jsonb NOT NULL DEFAULT '[]'::jsonb,
  pass_mark integer NOT NULL DEFAULT 2,
  min_dwell_seconds integer NOT NULL DEFAULT 90,
  priority integer NOT NULL DEFAULT 0,
  version integer NOT NULL DEFAULT 1,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_modules TO authenticated;
GRANT ALL ON public.training_modules TO service_role;
ALTER TABLE public.training_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage training modules" ON public.training_modules FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.crew_training_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id uuid NOT NULL,
  module_id uuid NOT NULL REFERENCES public.training_modules(id) ON DELETE CASCADE,
  module_version integer NOT NULL DEFAULT 1,
  token text NOT NULL UNIQUE DEFAULT (replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','')),
  source text NOT NULL DEFAULT 'self' CHECK (source IN ('self','manager','admin')),
  assigned_by uuid,
  invite_id uuid,
  trading_area text,
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  match_score integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned','opened','completed')),
  opened_at timestamptz,
  completed_at timestamptz,
  dwell_seconds integer,
  quiz_correct integer,
  quiz_total integer,
  attempts integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (crew_id, module_id)
);
CREATE INDEX crew_training_assignments_crew_idx ON public.crew_training_assignments(crew_id, status);
GRANT SELECT ON public.crew_training_assignments TO authenticated;
GRANT ALL ON public.crew_training_assignments TO service_role;
ALTER TABLE public.crew_training_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Crew read own training" ON public.crew_training_assignments FOR SELECT TO authenticated
  USING (crew_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.training_vessel_family(p text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN p IS NULL OR btrim(p) = '' THEN NULL
    WHEN lower(p) ~ 'lng' THEN 'LNG'
    WHEN lower(p) ~ 'lpg' THEN 'LPG'
    WHEN lower(p) ~ 'chem' THEN 'CHEM_TANKER'
    WHEN lower(p) ~ '(oil|crude|product|tanker)' THEN 'OIL_TANKER'
    WHEN lower(p) ~ 'bulk' THEN 'BULK'
    WHEN lower(p) ~ 'container' THEN 'CONTAINER'
    WHEN lower(p) ~ 'general' THEN 'GENERAL_CARGO'
    WHEN lower(p) ~ 'ahts' THEN 'AHTS'
    WHEN lower(p) ~ '(psv|osv|offshore)' THEN 'PSV_OSV'
    WHEN lower(p) ~ '(ro-ro|roro|pax|passenger|ferry|cruise)' THEN 'RORO_PAX'
    ELSE NULL END
$$;

CREATE OR REPLACE FUNCTION public.training_recommend_core(p_crew uuid, p_area text, p_target_vessel text, p_limit integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_dept text; v_level text; v_rank text; fams text[] := '{}'; tfam text; weak jsonb; res jsonb;
BEGIN
  SELECT rank INTO v_rank FROM crew_profiles WHERE id = p_crew;
  IF v_rank IS NOT NULL THEN
    SELECT department, level INTO v_dept, v_level FROM rank_taxonomy
     WHERE position(rank_pattern IN lower(v_rank)) > 0 ORDER BY length(rank_pattern) DESC LIMIT 1;
  END IF;
  SELECT coalesce(array_agg(DISTINCT vessel_family), '{}') INTO fams FROM crew_vessel_experience WHERE crew_id = p_crew;
  SELECT fams || coalesce(array_agg(DISTINCT f), '{}') INTO fams FROM (
    SELECT training_vessel_family(v->>'vessel_type') f FROM crew_cv_data c, jsonb_array_elements(CASE WHEN jsonb_typeof(c.sea_service)='array' THEN c.sea_service ELSE '[]'::jsonb END) v
     WHERE c.user_id = p_crew AND jsonb_typeof(v) = 'object') s WHERE f IS NOT NULL;
  tfam := training_vessel_family(p_target_vessel);
  IF tfam IS NOT NULL THEN fams := fams || tfam; END IF;

  SELECT coalesce(jsonb_object_agg(d, round(s::numeric, 1)), '{}'::jsonb) INTO weak FROM (
    SELECT lower(i.domain) d, avg(l.score) s
      FROM answer_ledger l
      JOIN issued_paper_keys k ON k.paper_id = l.paper_id AND k.paper_item_id = l.paper_item_id
      JOIN assessment_items i ON i.id = k.item_id
     WHERE l.crew_profile_id = p_crew AND l.score IS NOT NULL AND i.domain IS NOT NULL
       AND l.answered_at > now() - interval '18 months'
     GROUP BY 1 HAVING avg(l.score) < 6) w;

  WITH scored AS (
    SELECT m.*,
      (SELECT array_agg(d) FROM unnest(m.domains) d WHERE weak ? d) AS hit_domains,
      (m.vessel_families && fams) AS vhit,
      (tfam IS NOT NULL AND tfam = ANY(m.vessel_families)) AS thit,
      (v_dept IS NOT NULL AND v_dept = ANY(m.departments)) AS dhit,
      (p_area IS NOT NULL AND p_area = ANY(m.trading_areas)) AS ahit,
      (v_level IS NOT NULL AND v_level = ANY(m.levels)) AS lhit
    FROM training_modules m
    WHERE m.is_published
      AND (cardinality(m.departments) = 0 OR v_dept IS NULL OR v_dept = ANY(m.departments))
      AND (cardinality(m.vessel_families) = 0 OR m.vessel_families && fams)
      AND (cardinality(m.trading_areas) = 0 OR p_area = ANY(m.trading_areas))
      AND NOT EXISTS (SELECT 1 FROM crew_training_assignments a WHERE a.crew_id = p_crew AND a.module_id = m.id
                       AND a.status = 'completed' AND a.module_version >= m.version)
  ), ranked AS (
    SELECT s.*,
      (CASE WHEN hit_domains IS NOT NULL THEN 50 + 10 * least(cardinality(hit_domains) - 1, 2) ELSE 0 END)
      + (CASE WHEN thit THEN 25 WHEN vhit THEN 20 ELSE 0 END)
      + (CASE WHEN ahit THEN 20 ELSE 0 END) + (CASE WHEN dhit THEN 10 ELSE 0 END)
      + (CASE WHEN lhit THEN 5 ELSE 0 END) + s.priority AS score,
      to_jsonb(array_remove(ARRAY[
        CASE WHEN hit_domains IS NOT NULL THEN 'Exam gap: ' || array_to_string(hit_domains, ', ') || ' scored below 6/10' END,
        CASE WHEN thit THEN 'Target vessel: ' || p_target_vessel WHEN vhit THEN 'Matches vessel experience' END,
        CASE WHEN ahit THEN 'Trading area focus: ' || p_area END,
        CASE WHEN dhit THEN v_dept || ' department requirement' END,
        CASE WHEN lhit THEN v_level || ' level' END
      ], NULL)) AS reasons
    FROM scored s
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('slug', slug, 'title', title, 'summary', summary, 'score', score,
           'reasons', CASE WHEN jsonb_array_length(reasons) = 0 THEN '["Core safety requirement"]'::jsonb ELSE reasons END,
           'gap', hit_domains IS NOT NULL, 'domains', to_jsonb(domains),
           'assigned', EXISTS (SELECT 1 FROM crew_training_assignments a WHERE a.crew_id = p_crew AND a.module_id = r.id))
         ORDER BY score DESC, title), '[]'::jsonb)
    INTO res FROM (SELECT * FROM ranked ORDER BY score DESC, title LIMIT greatest(1, least(coalesce(p_limit, 3), 10))) r;

  RETURN jsonb_build_object('ok', true, 'department', v_dept, 'level', v_level, 'vessel_families', to_jsonb(fams),
    'weak_domains', weak, 'items', res);
END $$;
REVOKE ALL ON FUNCTION public.training_recommend_core(uuid, text, text, integer) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.training_resolve_crew(p_invite_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error_code', 'AUTH_REQUIRED'); END IF;
  IF p_invite_id IS NULL THEN RETURN jsonb_build_object('ok', true, 'crew_id', uid, 'source', 'self'); END IF;
  SELECT i.crew_profile_id, c.manager_id, c.vessel_type INTO r
    FROM interview_invites i JOIN interview_campaigns c ON c.id = i.campaign_id WHERE i.id = p_invite_id;
  IF r.manager_id IS NULL OR (r.manager_id <> uid AND NOT is_admin(uid)) THEN RETURN jsonb_build_object('ok', false, 'error_code', 'FORBIDDEN'); END IF;
  IF r.crew_profile_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error_code', 'NOT_STARTED'); END IF;
  RETURN jsonb_build_object('ok', true, 'crew_id', r.crew_profile_id, 'vessel', r.vessel_type,
    'source', CASE WHEN r.manager_id = uid THEN 'manager' ELSE 'admin' END);
END $$;
REVOKE ALL ON FUNCTION public.training_resolve_crew(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.training_recommend(p_invite_id uuid DEFAULT NULL, p_area text DEFAULT NULL, p_limit integer DEFAULT 3)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE who jsonb;
BEGIN
  who := training_resolve_crew(p_invite_id);
  IF NOT (who->>'ok')::boolean THEN RETURN who; END IF;
  RETURN training_recommend_core((who->>'crew_id')::uuid, nullif(upper(btrim(p_area)), ''), who->>'vessel', p_limit);
END $$;

CREATE OR REPLACE FUNCTION public.training_assign(p_invite_id uuid DEFAULT NULL, p_slugs text[] DEFAULT NULL, p_area text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE who jsonb; rec jsonb; crew uuid; area text := nullif(upper(btrim(p_area)), ''); item jsonb; m record; outp jsonb := '[]'::jsonb; a record;
BEGIN
  who := training_resolve_crew(p_invite_id);
  IF NOT (who->>'ok')::boolean THEN RETURN who; END IF;
  crew := (who->>'crew_id')::uuid;
  IF p_slugs IS NOT NULL AND cardinality(p_slugs) > 5 THEN RETURN jsonb_build_object('ok', false, 'error_code', 'TOO_MANY'); END IF;
  rec := training_recommend_core(crew, area, who->>'vessel', 10);
  FOR item IN SELECT e FROM jsonb_array_elements(rec->'items') e
     WHERE (p_slugs IS NULL AND (e->>'score')::int > 0) OR (p_slugs IS NOT NULL AND e->>'slug' = ANY(p_slugs))
     LIMIT CASE WHEN p_slugs IS NULL THEN 2 ELSE 5 END
  LOOP
    SELECT id, version INTO m FROM training_modules WHERE slug = item->>'slug' AND is_published;
    INSERT INTO crew_training_assignments(crew_id, module_id, module_version, source, assigned_by, invite_id, trading_area, reasons, match_score)
    VALUES (crew, m.id, m.version, who->>'source', auth.uid(), p_invite_id, area, item->'reasons', (item->>'score')::int)
    ON CONFLICT (crew_id, module_id) DO UPDATE
      SET module_version = EXCLUDED.module_version, status = 'assigned', opened_at = NULL, completed_at = NULL,
          quiz_correct = NULL, quiz_total = NULL, attempts = 0, reasons = EXCLUDED.reasons, match_score = EXCLUDED.match_score
      WHERE crew_training_assignments.status = 'completed' AND crew_training_assignments.module_version < EXCLUDED.module_version;
    SELECT token, status INTO a FROM crew_training_assignments WHERE crew_id = crew AND module_id = m.id;
    outp := outp || jsonb_build_object('slug', item->>'slug', 'title', item->>'title', 'token', a.token, 'status', a.status);
  END LOOP;
  IF jsonb_array_length(outp) = 0 THEN RETURN jsonb_build_object('ok', false, 'error_code', 'NOTHING_TO_ASSIGN'); END IF;
  RETURN jsonb_build_object('ok', true, 'assigned', outp);
END $$;

CREATE OR REPLACE FUNCTION public.training_open(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); a record; m record;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error_code', 'AUTH_REQUIRED'); END IF;
  SELECT * INTO a FROM crew_training_assignments WHERE token = p_token;
  IF a.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error_code', 'NOT_FOUND'); END IF;
  IF a.crew_id <> uid THEN RETURN jsonb_build_object('ok', false, 'error_code', 'WRONG_ACCOUNT'); END IF;
  IF a.status = 'assigned' THEN
    UPDATE crew_training_assignments SET status = 'opened', opened_at = now() WHERE id = a.id RETURNING * INTO a;
  END IF;
  SELECT * INTO m FROM training_modules WHERE id = a.module_id;
  RETURN jsonb_build_object('ok', true, 'status', a.status, 'title', m.title, 'summary', m.summary, 'key_points', m.key_points,
    'media_url', m.media_url, 'media_label', m.media_label, 'concepts', to_jsonb(m.concepts), 'reasons', a.reasons,
    'min_dwell_seconds', m.min_dwell_seconds,
    'elapsed_seconds', greatest(0, extract(epoch FROM now() - a.opened_at))::int,
    'quiz', (SELECT coalesce(jsonb_agg(jsonb_build_object('q', q->>'q', 'options', q->'options') ORDER BY o), '[]'::jsonb)
               FROM jsonb_array_elements(m.quiz) WITH ORDINALITY t(q, o)),
    'pass_mark', m.pass_mark, 'attempts', a.attempts, 'quiz_correct', a.quiz_correct, 'quiz_total', a.quiz_total,
    'completed_at', a.completed_at);
END $$;

CREATE OR REPLACE FUNCTION public.training_complete(p_token text, p_answers integer[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); a record; m record; total int; correct int := 0; wrong int[] := '{}'; i int; elapsed int; passed boolean;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error_code', 'AUTH_REQUIRED'); END IF;
  SELECT * INTO a FROM crew_training_assignments WHERE token = p_token FOR UPDATE;
  IF a.id IS NULL OR a.crew_id <> uid THEN RETURN jsonb_build_object('ok', false, 'error_code', 'NOT_FOUND'); END IF;
  IF a.status = 'completed' THEN
    RETURN jsonb_build_object('ok', true, 'passed', true, 'already_completed', true, 'correct', a.quiz_correct, 'total', a.quiz_total);
  END IF;
  IF a.opened_at IS NULL THEN RETURN jsonb_build_object('ok', false, 'error_code', 'NOT_OPENED'); END IF;
  SELECT * INTO m FROM training_modules WHERE id = a.module_id;
  elapsed := extract(epoch FROM now() - a.opened_at)::int;
  IF elapsed < m.min_dwell_seconds THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'TOO_FAST', 'wait_seconds', m.min_dwell_seconds - elapsed);
  END IF;
  IF a.last_attempt_at IS NOT NULL AND now() - a.last_attempt_at < interval '60 seconds' THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'COOLDOWN', 'wait_seconds', 60 - extract(epoch FROM now() - a.last_attempt_at)::int);
  END IF;
  total := jsonb_array_length(m.quiz);
  IF p_answers IS NULL OR cardinality(p_answers) <> total THEN RETURN jsonb_build_object('ok', false, 'error_code', 'INCOMPLETE'); END IF;
  FOR i IN 1..total LOOP
    IF p_answers[i] = (m.quiz->(i-1)->>'correct')::int THEN correct := correct + 1; ELSE wrong := wrong || i; END IF;
  END LOOP;
  passed := correct >= least(m.pass_mark, total);
  UPDATE crew_training_assignments SET attempts = attempts + 1, last_attempt_at = now(), quiz_correct = correct, quiz_total = total,
    status = CASE WHEN passed THEN 'completed' ELSE status END,
    completed_at = CASE WHEN passed THEN now() ELSE NULL END,
    dwell_seconds = CASE WHEN passed THEN elapsed ELSE dwell_seconds END
   WHERE id = a.id;
  RETURN jsonb_build_object('ok', true, 'passed', passed, 'correct', correct, 'total', total,
    'wrong_questions', CASE WHEN passed THEN '[]'::jsonb ELSE to_jsonb(wrong) END);
END $$;

CREATE OR REPLACE FUNCTION public.training_ledger(p_invite_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE who jsonb; crew uuid; self boolean;
BEGIN
  who := training_resolve_crew(p_invite_id);
  IF NOT (who->>'ok')::boolean THEN RETURN who; END IF;
  crew := (who->>'crew_id')::uuid; self := who->>'source' = 'self';
  RETURN jsonb_build_object('ok', true, 'items', coalesce((
    SELECT jsonb_agg(jsonb_build_object('title', m.title, 'slug', m.slug, 'status', a.status, 'reasons', a.reasons,
      'assigned_at', a.created_at, 'opened_at', a.opened_at, 'completed_at', a.completed_at, 'dwell_seconds', a.dwell_seconds,
      'quiz_correct', a.quiz_correct, 'quiz_total', a.quiz_total, 'concepts', to_jsonb(m.concepts),
      'token', CASE WHEN self OR a.assigned_by = auth.uid() THEN a.token END) ORDER BY a.created_at DESC)
    FROM crew_training_assignments a JOIN training_modules m ON m.id = a.module_id
    WHERE a.crew_id = crew AND (self OR a.status = 'completed' OR a.assigned_by = auth.uid() OR is_admin(auth.uid()))), '[]'::jsonb));
END $$;

REVOKE ALL ON FUNCTION public.training_recommend(uuid, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.training_assign(uuid, text[], text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.training_open(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.training_complete(text, integer[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.training_ledger(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.training_recommend(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.training_assign(uuid, text[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.training_open(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.training_complete(text, integer[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.training_ledger(uuid) TO authenticated;