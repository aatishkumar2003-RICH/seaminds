CREATE OR REPLACE FUNCTION public.crew_my_companies()
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_email text := lower(coalesce(auth.jwt()->>'email','')); r jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RETURN '[]'::jsonb; END IF;
  IF v_email <> '' THEN UPDATE cadet_enrollments SET crew_id = auth.uid() WHERE crew_id IS NULL AND email = v_email; END IF;
  WITH links AS (
    SELECT c.manager_id uid, coalesce(c.accepted_at, c.created_at) since, 'roster'::text kind
      FROM company_crew_records c WHERE c.crew_id = auth.uid() AND c.status = 'accepted'
    UNION ALL
    SELECT l.manager_id, l.created_at, 'training' FROM manager_training_links l WHERE l.crew_id = auth.uid()
    UNION ALL
    SELECT mp.user_id, coalesce(f.linked_at, f.created_at), 'fleet'
      FROM company_fleet_links f JOIN manager_profiles mp ON mp.id = f.manager_id
      WHERE f.crew_id = auth.uid() AND f.status = 'active'
    UNION ALL
    SELECT e.manager_id, e.created_at, 'cadet' FROM cadet_enrollments e WHERE e.crew_id = auth.uid() AND e.status <> 'withdrawn'
  )
  SELECT coalesce(jsonb_agg(x ORDER BY x->>'since'), '[]'::jsonb) INTO r FROM (
    SELECT jsonb_build_object('manager_uid', l.uid,
      'company', coalesce(max(mp.company_name), 'A company'),
      'since', min(l.since), 'kinds', array_agg(DISTINCT l.kind)) x
    FROM links l LEFT JOIN manager_profiles mp ON mp.user_id = l.uid
    WHERE l.uid IS NOT NULL GROUP BY l.uid) s;
  RETURN r;
END $function$;

CREATE OR REPLACE FUNCTION public.crew_disconnect_company(p_manager_uid uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v uuid := auth.uid(); n int := 0; c int;
BEGIN
  IF v IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_signed_in'); END IF;
  DELETE FROM manager_training_links WHERE crew_id = v AND manager_id = p_manager_uid; GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  UPDATE company_fleet_links SET status = 'revoked'
    WHERE crew_id = v AND status IN ('active','pending')
      AND manager_id IN (SELECT id FROM manager_profiles WHERE user_id = p_manager_uid);
  GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  DELETE FROM company_crew_records WHERE crew_id = v AND manager_id = p_manager_uid; GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  UPDATE cadet_enrollments SET status = 'withdrawn' WHERE crew_id = v AND manager_id = p_manager_uid AND status <> 'withdrawn';
  GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  RETURN jsonb_build_object('ok', n > 0, 'removed', n);
END $function$;