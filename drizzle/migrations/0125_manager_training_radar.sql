CREATE TABLE IF NOT EXISTS public.manager_training_links (
  manager_id uuid NOT NULL,
  crew_id uuid NOT NULL,
  source text NOT NULL DEFAULT 'invite',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (manager_id, crew_id)
);
CREATE INDEX IF NOT EXISTS idx_mtl_crew ON public.manager_training_links (crew_id);
GRANT SELECT ON public.manager_training_links TO authenticated;
GRANT ALL ON public.manager_training_links TO service_role;
ALTER TABLE public.manager_training_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mtl read own" ON public.manager_training_links FOR SELECT TO authenticated
  USING (manager_id = auth.uid() OR crew_id = auth.uid());

-- Crew consents by opening a manager's training link while signed in.
CREATE OR REPLACE FUNCTION public.crew_share_training(p_manager_profile uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_mgr uuid; v_company text;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED'); END IF;
  SELECT user_id, company_name INTO v_mgr, v_company FROM manager_profiles WHERE id = p_manager_profile;
  IF v_mgr IS NULL OR v_mgr = v_uid THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); END IF;
  IF NOT EXISTS (SELECT 1 FROM crew_profiles WHERE id = v_uid) THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_CREW'); END IF;
  INSERT INTO manager_training_links (manager_id, crew_id) VALUES (v_mgr, v_uid) ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('ok', true, 'company', v_company);
END $$;
REVOKE ALL ON FUNCTION public.crew_share_training(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.crew_share_training(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.manager_training_radar(p_search text DEFAULT '', p_offset int DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_ok boolean; v_rows jsonb; v_total int;
BEGIN
  SELECT coalesce(admin_approved, false) INTO v_ok FROM manager_profiles WHERE user_id = v_uid;
  IF v_ok IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_MANAGER'); END IF;
  WITH base AS (
    SELECT l.crew_id, l.created_at linked_at, p.first_name, p.last_name, p.rank, p.email, p.whatsapp_number, p.last_seen
    FROM manager_training_links l JOIN crew_profiles p ON p.id = l.crew_id
    WHERE l.manager_id = v_uid
      AND (coalesce(p_search,'') = '' OR (coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')||' '||coalesce(p.rank,'')||' '||coalesce(p.email,'')) ILIKE '%'||p_search||'%')
  ), stats AS (
    SELECT b.*,
      (SELECT count(*) FROM english_attempts e WHERE e.user_id = b.crew_id) eng_n,
      (SELECT count(*) FROM english_attempts e WHERE e.user_id = b.crew_id AND e.created_at > now() - interval '24 hours') eng_24h,
      (SELECT round(avg(score)) FROM (SELECT score FROM english_attempts e WHERE e.user_id = b.crew_id ORDER BY created_at DESC LIMIT 10) x) eng_avg,
      (SELECT max(score) FROM english_attempts e WHERE e.user_id = b.crew_id) eng_best,
      (SELECT max(created_at) FROM english_attempts e WHERE e.user_id = b.crew_id) eng_last,
      (SELECT scenario_id FROM english_attempts e WHERE e.user_id = b.crew_id ORDER BY created_at DESC LIMIT 1) eng_scenario,
      (SELECT count(*) FROM crew_training_assignments a WHERE a.crew_id = b.crew_id AND a.status = 'completed') mod_done,
      (SELECT count(*) FROM crew_training_assignments a WHERE a.crew_id = b.crew_id) mod_total,
      (SELECT max(coalesce(completed_at, last_attempt_at, opened_at, created_at)) FROM crew_training_assignments a WHERE a.crew_id = b.crew_id) mod_last,
      (SELECT count(*) FROM maritime_interview_sessions s WHERE s.crew_id = b.crew_id) int_n,
      (SELECT max(updated_at) FROM maritime_interview_sessions s WHERE s.crew_id = b.crew_id) int_last
    FROM base b
  )
  SELECT count(*) OVER ()::int, NULL INTO v_total FROM stats LIMIT 1;
  SELECT coalesce(jsonb_agg(r ORDER BY r->>'last_active' DESC NULLS LAST), '[]'::jsonb) INTO v_rows FROM (
    SELECT jsonb_build_object(
      'crew_id', crew_id, 'name', trim(coalesce(first_name,'')||' '||coalesce(last_name,'')), 'rank', rank,
      'email', CASE WHEN v_ok THEN email END, 'whatsapp', CASE WHEN v_ok THEN whatsapp_number END,
      'linked_at', linked_at, 'eng_attempts', eng_n, 'eng_24h', eng_24h, 'eng_avg', eng_avg, 'eng_best', eng_best,
      'eng_last', eng_last, 'eng_scenario', eng_scenario, 'modules_done', mod_done, 'modules_total', mod_total,
      'interviews', int_n,
      'last_active', GREATEST(eng_last, mod_last, int_last, last_seen)) r
    FROM (
      SELECT * FROM (
        SELECT b.*,
          (SELECT count(*) FROM english_attempts e WHERE e.user_id = b.crew_id) eng_n,
          (SELECT count(*) FROM english_attempts e WHERE e.user_id = b.crew_id AND e.created_at > now() - interval '24 hours') eng_24h,
          (SELECT round(avg(score)) FROM (SELECT score FROM english_attempts e WHERE e.user_id = b.crew_id ORDER BY created_at DESC LIMIT 10) x) eng_avg,
          (SELECT max(score) FROM english_attempts e WHERE e.user_id = b.crew_id) eng_best,
          (SELECT max(created_at) FROM english_attempts e WHERE e.user_id = b.crew_id) eng_last,
          (SELECT scenario_id FROM english_attempts e WHERE e.user_id = b.crew_id ORDER BY created_at DESC LIMIT 1) eng_scenario,
          (SELECT count(*) FROM crew_training_assignments a WHERE a.crew_id = b.crew_id AND a.status = 'completed') mod_done,
          (SELECT count(*) FROM crew_training_assignments a WHERE a.crew_id = b.crew_id) mod_total,
          (SELECT max(coalesce(completed_at, last_attempt_at, opened_at, created_at)) FROM crew_training_assignments a WHERE a.crew_id = b.crew_id) mod_last,
          (SELECT count(*) FROM maritime_interview_sessions s WHERE s.crew_id = b.crew_id) int_n,
          (SELECT max(updated_at) FROM maritime_interview_sessions s WHERE s.crew_id = b.crew_id) int_last
        FROM (
          SELECT l.crew_id, l.created_at linked_at, p.first_name, p.last_name, p.rank, p.email, p.whatsapp_number, p.last_seen
          FROM manager_training_links l JOIN crew_profiles p ON p.id = l.crew_id
          WHERE l.manager_id = v_uid
            AND (coalesce(p_search,'') = '' OR (coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')||' '||coalesce(p.rank,'')||' '||coalesce(p.email,'')) ILIKE '%'||p_search||'%')
        ) b
      ) s ORDER BY GREATEST(eng_last, mod_last, int_last, last_seen) DESC NULLS LAST
      OFFSET greatest(coalesce(p_offset,0),0) LIMIT 25
    ) q
  ) z;
  RETURN jsonb_build_object('ok', true, 'approved', v_ok, 'total', coalesce(v_total,0), 'rows', v_rows);
END $$;
REVOKE ALL ON FUNCTION public.manager_training_radar(text, int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.manager_training_radar(text, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.manager_training_detail(p_crew uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM manager_training_links WHERE manager_id = v_uid AND crew_id = p_crew) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_LINKED'); END IF;
  RETURN jsonb_build_object('ok', true,
    'english', coalesce((SELECT jsonb_agg(jsonb_build_object('scenario', scenario_id, 'score', score, 'daily', is_daily, 'at', created_at) ORDER BY created_at DESC)
       FROM (SELECT * FROM english_attempts WHERE user_id = p_crew ORDER BY created_at DESC LIMIT 150) e), '[]'::jsonb),
    'modules', coalesce((SELECT jsonb_agg(jsonb_build_object('title', m.title, 'tier', m.tier, 'status', a.status, 'source', a.source,
       'quiz_correct', a.quiz_correct, 'quiz_total', a.quiz_total, 'attempts', a.attempts, 'dwell', a.dwell_seconds,
       'opened_at', a.opened_at, 'completed_at', a.completed_at, 'created_at', a.created_at) ORDER BY coalesce(a.completed_at, a.created_at) DESC)
       FROM crew_training_assignments a JOIN training_modules m ON m.id = a.module_id WHERE a.crew_id = p_crew), '[]'::jsonb),
    'interviews', coalesce((SELECT jsonb_agg(jsonb_build_object('status', s.status, 'rank', s.rank, 'target_rank', s.target_rank,
       'started_at', s.started_at, 'completed_at', s.completed_at, 'updated_at', s.updated_at,
       'turns', CASE WHEN jsonb_typeof(s.turns) = 'array' THEN jsonb_array_length(s.turns) ELSE 0 END,
       'shared', s.share_with_managers,
       'technical_pct', CASE WHEN s.share_with_managers THEN s.technical_pct END,
       'verdict', CASE WHEN s.share_with_managers THEN s.verdict END,
       'safety_flags', CASE WHEN s.share_with_managers THEN s.safety_flags END) ORDER BY s.started_at DESC)
       FROM maritime_interview_sessions s WHERE s.crew_id = p_crew), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.manager_training_detail(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.manager_training_detail(uuid) TO authenticated;