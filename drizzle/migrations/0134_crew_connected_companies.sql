CREATE OR REPLACE FUNCTION public.crew_my_companies()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH links AS (
    SELECT r.manager_id uid, coalesce(r.accepted_at, r.created_at) since, 'roster'::text kind
      FROM company_crew_records r WHERE r.crew_id = auth.uid() AND r.status = 'accepted'
    UNION ALL
    SELECT l.manager_id, l.created_at, 'training' FROM manager_training_links l WHERE l.crew_id = auth.uid()
    UNION ALL
    SELECT mp.user_id, coalesce(f.linked_at, f.created_at), 'fleet'
      FROM company_fleet_links f JOIN manager_profiles mp ON mp.id = f.manager_id
      WHERE f.crew_id = auth.uid() AND f.status = 'active'
  )
  SELECT coalesce(jsonb_agg(x ORDER BY x->>'since'), '[]'::jsonb) FROM (
    SELECT jsonb_build_object('manager_uid', l.uid,
      'company', coalesce(max(mp.company_name), 'A company'),
      'since', min(l.since), 'kinds', array_agg(DISTINCT l.kind)) x
    FROM links l LEFT JOIN manager_profiles mp ON mp.user_id = l.uid
    WHERE l.uid IS NOT NULL GROUP BY l.uid) s;
$$;

CREATE OR REPLACE FUNCTION public.crew_disconnect_company(p_manager_uid uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v uuid := auth.uid(); n int := 0; c int;
BEGIN
  IF v IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_signed_in'); END IF;
  DELETE FROM manager_training_links WHERE crew_id = v AND manager_id = p_manager_uid; GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  UPDATE company_fleet_links SET status = 'revoked'
    WHERE crew_id = v AND status IN ('active','pending')
      AND manager_id IN (SELECT id FROM manager_profiles WHERE user_id = p_manager_uid);
  GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  -- The company's office copy is removed; the crew's own CV, certificates and documents are untouched.
  DELETE FROM company_crew_records WHERE crew_id = v AND manager_id = p_manager_uid; GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  RETURN jsonb_build_object('ok', n > 0, 'removed', n);
END $$;

REVOKE ALL ON FUNCTION public.crew_my_companies() FROM public, anon;
REVOKE ALL ON FUNCTION public.crew_disconnect_company(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.crew_my_companies() TO authenticated;
GRANT EXECUTE ON FUNCTION public.crew_disconnect_company(uuid) TO authenticated;