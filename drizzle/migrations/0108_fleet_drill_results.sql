CREATE TABLE public.fleet_drill_results (
  crew_id uuid NOT NULL,
  drill_key text NOT NULL CHECK (drill_key IN ('bulk','gas','container','tanker','reefer')),
  correct boolean NOT NULL,
  attempts integer NOT NULL DEFAULT 1,
  first_passed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (crew_id, drill_key)
);
GRANT SELECT ON public.fleet_drill_results TO authenticated;
GRANT ALL ON public.fleet_drill_results TO service_role;
ALTER TABLE public.fleet_drill_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crew_read_own_drills" ON public.fleet_drill_results FOR SELECT TO authenticated USING (crew_id = auth.uid());

CREATE OR REPLACE FUNCTION public.record_fleet_drill(p_drill text, p_choice int)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ok boolean; v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  v_ok := CASE p_drill WHEN 'bulk' THEN p_choice = 1 WHEN 'gas' THEN p_choice = 1 WHEN 'container' THEN p_choice = 2 WHEN 'tanker' THEN p_choice = 1 WHEN 'reefer' THEN p_choice = 2 ELSE NULL END;
  IF v_ok IS NULL THEN RAISE EXCEPTION 'unknown drill'; END IF;
  INSERT INTO fleet_drill_results(crew_id, drill_key, correct, first_passed_at)
  VALUES (v_uid, p_drill, v_ok, CASE WHEN v_ok THEN now() END)
  ON CONFLICT (crew_id, drill_key) DO UPDATE SET
    correct = fleet_drill_results.correct OR EXCLUDED.correct,
    attempts = fleet_drill_results.attempts + 1,
    first_passed_at = COALESCE(fleet_drill_results.first_passed_at, EXCLUDED.first_passed_at),
    updated_at = now();
  RETURN v_ok;
END $$;
REVOKE ALL ON FUNCTION public.record_fleet_drill(text,int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.record_fleet_drill(text,int) TO authenticated;