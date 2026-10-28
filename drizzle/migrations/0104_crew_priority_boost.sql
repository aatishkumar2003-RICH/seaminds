CREATE TABLE public.crew_boosts (
  crew_id uuid PRIMARY KEY,
  boosted_until timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.crew_boosts TO authenticated;
GRANT ALL ON public.crew_boosts TO service_role;
ALTER TABLE public.crew_boosts ENABLE ROW LEVEL SECURITY;
CREATE POLICY crew_boosts_read_own ON public.crew_boosts FOR SELECT TO authenticated USING (crew_id = auth.uid());

-- Crew spend credits for Top-of-Desk priority: 1 day = 1 credit, 7 days = 5 credits. Extends any active boost.
CREATE OR REPLACE FUNCTION public.boost_my_profile(p_days int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u uuid := auth.uid(); v_cost int; v_bal int; v_until timestamptz;
BEGIN
  IF u IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_signed_in'); END IF;
  IF p_days = 1 THEN v_cost := 1; ELSIF p_days = 7 THEN v_cost := 5;
  ELSE RETURN jsonb_build_object('ok', false, 'reason', 'invalid_plan'); END IF;
  IF NOT EXISTS (SELECT 1 FROM crew_profiles WHERE id = u) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_profile'); END IF;
  PERFORM pg_advisory_xact_lock(hashtext('crew_boost_' || u::text));
  SELECT coalesce(sum(delta), 0) INTO v_bal FROM credit_ledger WHERE manager_user_id = u;
  IF v_bal < v_cost THEN RETURN jsonb_build_object('ok', false, 'reason', 'insufficient_credits', 'balance', v_bal); END IF;
  INSERT INTO credit_ledger (manager_user_id, delta, reason)
    VALUES (u, -v_cost, 'crew_boost_' || p_days || 'd_' || gen_random_uuid()::text);
  INSERT INTO crew_boosts (crew_id, boosted_until) VALUES (u, now() + make_interval(days => p_days))
  ON CONFLICT (crew_id) DO UPDATE
    SET boosted_until = greatest(crew_boosts.boosted_until, now()) + make_interval(days => p_days), updated_at = now()
  RETURNING boosted_until INTO v_until;
  RETURN jsonb_build_object('ok', true, 'boosted_until', v_until, 'balance', v_bal - v_cost);
END $$;
REVOKE ALL ON FUNCTION public.boost_my_profile(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.boost_my_profile(int) TO authenticated;