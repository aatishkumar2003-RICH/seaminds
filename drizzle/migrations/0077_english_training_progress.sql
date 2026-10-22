CREATE TABLE IF NOT EXISTS public.english_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  scenario_id text NOT NULL,
  score int NOT NULL,
  is_daily boolean NOT NULL DEFAULT false,
  practice_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_english_attempts_user ON public.english_attempts (user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_english_daily ON public.english_attempts (user_id, practice_date) WHERE is_daily;
CREATE UNIQUE INDEX IF NOT EXISTS uq_credit_ledger_english_streak ON public.credit_ledger (manager_user_id, reason) WHERE reason LIKE 'english_streak_%';
GRANT SELECT ON public.english_attempts TO authenticated;
GRANT ALL ON public.english_attempts TO service_role;
ALTER TABLE public.english_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own english attempts" ON public.english_attempts FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.english_summary_for(p_uid uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH days AS (SELECT DISTINCT practice_date d FROM english_attempts WHERE user_id = p_uid AND is_daily),
  run AS (SELECT d, d - (row_number() OVER (ORDER BY d))::int AS grp FROM days),
  cur AS (SELECT count(*) n, max(d) last FROM run WHERE grp = (SELECT grp FROM run ORDER BY d DESC LIMIT 1)),
  recent AS (SELECT score FROM english_attempts WHERE user_id = p_uid ORDER BY created_at DESC LIMIT 10)
  SELECT jsonb_build_object(
    'streak', CASE WHEN (SELECT last FROM cur) >= (now() AT TIME ZONE 'utc')::date - 1 THEN coalesce((SELECT n FROM cur),0) ELSE 0 END,
    'avg', (SELECT round(avg(score))::int FROM recent),
    'attempts', (SELECT count(*) FROM english_attempts WHERE user_id = p_uid),
    'best', coalesce((SELECT jsonb_object_agg(scenario_id, b) FROM (SELECT scenario_id, max(score) b FROM english_attempts WHERE user_id = p_uid GROUP BY scenario_id) x), '{}'::jsonb),
    'daily', coalesce((SELECT jsonb_object_agg(practice_date::text, score) FROM english_attempts WHERE user_id = p_uid AND is_daily), '{}'::jsonb)
  );
$$;

CREATE OR REPLACE FUNCTION public.get_my_english_summary()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;
  RETURN english_summary_for(auth.uid()) || jsonb_build_object('ok', true);
END $$;

-- Records one attempt; daily challenge counts once per UTC day; every 7-day streak earns credits once.
CREATE OR REPLACE FUNCTION public.record_english_attempt(p_scenario text, p_score int, p_daily boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_sum jsonb; v_streak int; v_award int := 5; n int := 0; v_daily boolean := p_daily;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'AUTH_REQUIRED'); END IF;
  IF p_score IS NULL OR p_score < 0 OR p_score > 100 OR length(coalesce(p_scenario,'')) NOT BETWEEN 1 AND 60 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID'); END IF;
  IF (SELECT count(*) FROM english_attempts WHERE user_id = v_uid AND created_at > now() - interval '1 hour') >= 120 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'RATE_LIMIT'); END IF;
  IF v_daily AND EXISTS (SELECT 1 FROM english_attempts WHERE user_id = v_uid AND is_daily AND practice_date = (now() AT TIME ZONE 'utc')::date) THEN
    v_daily := false; END IF;
  INSERT INTO english_attempts (user_id, scenario_id, score, is_daily) VALUES (v_uid, p_scenario, p_score, v_daily);
  v_sum := english_summary_for(v_uid);
  v_streak := (v_sum->>'streak')::int;
  IF v_daily AND v_streak > 0 AND v_streak % 7 = 0 THEN
    INSERT INTO credit_ledger (manager_user_id, delta, reason)
    VALUES (v_uid, v_award, 'english_streak_' || (now() AT TIME ZONE 'utc')::date::text) ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS n = ROW_COUNT;
  END IF;
  RETURN v_sum || jsonb_build_object('ok', true, 'credited', CASE WHEN n > 0 THEN v_award ELSE 0 END, 'counted_daily', v_daily);
END $$;

REVOKE ALL ON FUNCTION public.english_summary_for(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_my_english_summary() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_english_attempt(text, int, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.english_summary_for(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_my_english_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_english_attempt(text, int, boolean) TO authenticated;
NOTIFY pgrst, 'reload schema';