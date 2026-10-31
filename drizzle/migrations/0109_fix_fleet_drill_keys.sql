CREATE OR REPLACE FUNCTION public.record_fleet_drill(p_drill text, p_choice int)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ok boolean; v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  IF p_drill NOT IN ('bulk','gas','container','tanker','reefer') THEN RAISE EXCEPTION 'unknown drill'; END IF;
  v_ok := p_choice = 1;
  INSERT INTO fleet_drill_results(crew_id, drill_key, correct, first_passed_at)
  VALUES (v_uid, p_drill, v_ok, CASE WHEN v_ok THEN now() END)
  ON CONFLICT (crew_id, drill_key) DO UPDATE SET
    correct = fleet_drill_results.correct OR EXCLUDED.correct,
    attempts = fleet_drill_results.attempts + 1,
    first_passed_at = COALESCE(fleet_drill_results.first_passed_at, EXCLUDED.first_passed_at),
    updated_at = now();
  RETURN v_ok;
END $$;