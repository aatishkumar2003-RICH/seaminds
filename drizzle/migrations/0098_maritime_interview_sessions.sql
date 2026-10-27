CREATE TABLE public.maritime_interview_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id uuid NOT NULL,
  rank text NOT NULL,
  target_rank text,
  vessel text,
  language text,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','abandoned')),
  pending_question text,
  turns jsonb NOT NULL DEFAULT '[]'::jsonb,
  technical_pct integer,
  safety_flags integer,
  gaps jsonb,
  verdict text,
  share_with_managers boolean NOT NULL DEFAULT false,
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX maritime_interview_sessions_crew_idx ON public.maritime_interview_sessions (crew_id, started_at DESC);
GRANT SELECT ON public.maritime_interview_sessions TO authenticated;
GRANT ALL ON public.maritime_interview_sessions TO service_role;
ALTER TABLE public.maritime_interview_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crew read own interview sessions" ON public.maritime_interview_sessions
  FOR SELECT TO authenticated USING (crew_id = auth.uid());

CREATE OR REPLACE FUNCTION public.set_maritime_interview_share(p_session uuid, p_share boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.maritime_interview_sessions SET share_with_managers = p_share, updated_at = now()
   WHERE id = p_session AND crew_id = auth.uid() AND status = 'completed';
  RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.set_maritime_interview_share(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_maritime_interview_share(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.manager_maritime_report(p_application uuid)
RETURNS TABLE (id uuid, rank text, target_rank text, vessel text, technical_pct integer, safety_flags integer,
               gaps jsonb, verdict text, turns jsonb, completed_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.rank, s.target_rank, s.vessel, s.technical_pct, s.safety_flags, s.gaps, s.verdict,
         (SELECT coalesce(jsonb_agg(jsonb_build_object('question', t->>'question', 'answer', t->>'answer',
                 'topic', t->>'topic', 'depth', t->'depth', 'safety_flag', t->'safety_flag', 'gap', t->>'gap')), '[]'::jsonb)
            FROM jsonb_array_elements(s.turns) t),
         s.completed_at
    FROM public.job_applications a
    JOIN public.job_postings p ON p.id = a.job_posting_id AND p.manager_id = auth.uid()
    JOIN public.maritime_interview_sessions s ON s.crew_id = a.crew_id
   WHERE a.id = p_application AND s.status = 'completed' AND s.share_with_managers
   ORDER BY s.completed_at DESC
   LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.manager_maritime_report(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manager_maritime_report(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';