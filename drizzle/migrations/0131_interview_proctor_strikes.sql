CREATE TABLE public.interview_proctor_strikes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id uuid NOT NULL,
  assessment_id uuid,
  reason text NOT NULL,
  question_no int,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.interview_proctor_strikes TO authenticated;
GRANT ALL ON public.interview_proctor_strikes TO service_role;
ALTER TABLE public.interview_proctor_strikes ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_strikes_read ON public.interview_proctor_strikes FOR SELECT TO authenticated USING (crew_id = auth.uid());
CREATE INDEX ON public.interview_proctor_strikes (crew_id, created_at);

CREATE OR REPLACE FUNCTION public.record_proctor_strike(p_assessment_id uuid, p_reason text, p_question_no int)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  -- one strike per 5 seconds max (a single tab switch fires several events)
  IF NOT EXISTS (SELECT 1 FROM interview_proctor_strikes WHERE crew_id = auth.uid() AND created_at > now() - interval '5 seconds') THEN
    INSERT INTO interview_proctor_strikes(crew_id, assessment_id, reason, question_no)
    VALUES (auth.uid(), p_assessment_id, left(coalesce(p_reason,'unknown'),40), p_question_no);
  END IF;
  SELECT count(*) INTO n FROM interview_proctor_strikes WHERE crew_id = auth.uid() AND created_at > now() - interval '30 days';
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.my_proctor_strikes()
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int FROM interview_proctor_strikes WHERE crew_id = auth.uid() AND created_at > now() - interval '30 days';
$$;
REVOKE ALL ON FUNCTION public.record_proctor_strike(uuid,text,int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_proctor_strikes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_proctor_strike(uuid,text,int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_proctor_strikes() TO authenticated;