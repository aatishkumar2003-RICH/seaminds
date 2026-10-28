CREATE TABLE public.promotion_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL,
  crew_id uuid NOT NULL,
  application_id uuid NOT NULL,
  company_name text,
  current_rank text NOT NULL,
  target_rank text NOT NULL,
  vessel text NOT NULL DEFAULT 'bulk',
  note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','declined','cancelled')),
  session_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX promotion_invites_crew_idx ON public.promotion_invites (crew_id, status);
CREATE INDEX promotion_invites_mgr_idx ON public.promotion_invites (manager_id, created_at DESC);
CREATE UNIQUE INDEX promotion_invites_one_open ON public.promotion_invites (manager_id, crew_id, target_rank) WHERE status = 'pending';
GRANT SELECT ON public.promotion_invites TO authenticated;
GRANT ALL ON public.promotion_invites TO service_role;
ALTER TABLE public.promotion_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parties read promotion invites" ON public.promotion_invites
  FOR SELECT TO authenticated USING (crew_id = auth.uid() OR manager_id = auth.uid());

CREATE OR REPLACE FUNCTION public.manager_invite_promotion(p_application uuid, p_target_rank text, p_vessel text, p_note text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_crew uuid; v_rank text; v_id uuid; v_company text;
BEGIN
  IF NOT public._crew_desk_app_owned(p_application) THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF coalesce(trim(p_target_rank),'') = '' OR length(p_target_rank) > 60 THEN RAISE EXCEPTION 'invalid_rank'; END IF;
  SELECT ja.crew_id, coalesce(nullif(cp.rank,''), 'Crew') INTO v_crew, v_rank
    FROM job_applications ja LEFT JOIN crew_profiles cp ON cp.id = ja.crew_id WHERE ja.id = p_application;
  IF v_crew IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  SELECT company_name INTO v_company FROM manager_profiles WHERE user_id = auth.uid();
  SELECT id INTO v_id FROM promotion_invites WHERE manager_id = auth.uid() AND crew_id = v_crew AND target_rank = trim(p_target_rank) AND status = 'pending';
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  INSERT INTO promotion_invites (manager_id, crew_id, application_id, company_name, current_rank, target_rank, vessel, note)
  VALUES (auth.uid(), v_crew, p_application, v_company, v_rank, trim(p_target_rank), coalesce(nullif(p_vessel,''),'bulk'), left(nullif(trim(p_note),''), 500))
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.manager_invite_promotion(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manager_invite_promotion(uuid, text, text, text) TO authenticated;

-- Crew links a completed session to an invite; sharing is limited to that inviting manager.
CREATE OR REPLACE FUNCTION public.crew_complete_promotion(p_invite uuid, p_session uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM maritime_interview_sessions WHERE id = p_session AND crew_id = auth.uid() AND status = 'completed') THEN RETURN false; END IF;
  UPDATE promotion_invites SET status = 'completed', session_id = p_session, completed_at = now()
   WHERE id = p_invite AND crew_id = auth.uid() AND status = 'pending';
  RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.crew_complete_promotion(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crew_complete_promotion(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.crew_decline_promotion(p_invite uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH u AS (UPDATE promotion_invites SET status = 'declined' WHERE id = p_invite AND crew_id = auth.uid() AND status = 'pending' RETURNING 1)
  SELECT EXISTS (SELECT 1 FROM u);
$$;
REVOKE ALL ON FUNCTION public.crew_decline_promotion(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crew_decline_promotion(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.manager_promotion_board()
RETURNS TABLE (id uuid, crew_name text, current_rank text, target_rank text, vessel text, status text, created_at timestamptz, completed_at timestamptz,
               technical_pct integer, safety_flags integer, verdict text, gaps jsonb, turns jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT i.id, trim(coalesce(cp.first_name,'') || ' ' || coalesce(cp.last_name,'')), i.current_rank, i.target_rank, i.vessel, i.status, i.created_at, i.completed_at,
         s.technical_pct, s.safety_flags, s.verdict, s.gaps,
         CASE WHEN s.id IS NULL THEN NULL ELSE (SELECT coalesce(jsonb_agg(jsonb_build_object('question', t->>'question', 'answer', t->>'answer',
                 'topic', t->>'topic', 'safety_flag', t->'safety_flag', 'gap', t->>'gap')), '[]'::jsonb) FROM jsonb_array_elements(s.turns) t) END
    FROM promotion_invites i
    LEFT JOIN crew_profiles cp ON cp.id = i.crew_id
    LEFT JOIN maritime_interview_sessions s ON s.id = i.session_id AND s.status = 'completed'
   WHERE i.manager_id = auth.uid()
     AND EXISTS (SELECT 1 FROM manager_profiles WHERE user_id = auth.uid() AND admin_approved)
   ORDER BY i.created_at DESC LIMIT 200
$$;
REVOKE ALL ON FUNCTION public.manager_promotion_board() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manager_promotion_board() TO authenticated;
NOTIFY pgrst, 'reload schema';