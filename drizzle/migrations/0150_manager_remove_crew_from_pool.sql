CREATE OR REPLACE FUNCTION public.manager_remove_crew_from_pool(p_email text, p_crew_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_e text := lower(nullif(trim(coalesce(p_email,'')),'')); v_crew uuid := p_crew_id; n int := 0; c int;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM manager_profiles WHERE user_id = v_uid) THEN RETURN jsonb_build_object('ok',false,'error','NOT_MANAGER'); END IF;
  IF v_e IS NULL AND v_crew IS NULL THEN RETURN jsonb_build_object('ok',false,'error','NO_TARGET'); END IF;
  IF v_crew IS NULL AND v_e IS NOT NULL THEN SELECT id INTO v_crew FROM crew_profiles WHERE lower(email) = v_e LIMIT 1; END IF;
  DELETE FROM company_crew_records WHERE manager_id = v_uid AND ((v_e IS NOT NULL AND lower(email) = v_e) OR (v_crew IS NOT NULL AND crew_id = v_crew)); GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  IF v_crew IS NOT NULL THEN DELETE FROM manager_training_links WHERE manager_id = v_uid AND crew_id = v_crew; GET DIAGNOSTICS c = ROW_COUNT; n := n + c; END IF;
  IF v_e IS NOT NULL THEN DELETE FROM manager_training_invites WHERE manager_id = v_uid AND lower(email) = v_e; GET DIAGNOSTICS c = ROW_COUNT; n := n + c; END IF;
  DELETE FROM manager_training_sends WHERE manager_id = v_uid AND ((v_e IS NOT NULL AND lower(email) = v_e) OR (v_crew IS NOT NULL AND crew_id = v_crew)); GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  DELETE FROM cadet_enrollments WHERE manager_id = v_uid AND ((v_e IS NOT NULL AND lower(email) = v_e) OR (v_crew IS NOT NULL AND crew_id = v_crew)); GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  -- only unstarted interview invites; completed interviews are kept as history
  DELETE FROM interview_invites i USING interview_campaigns cm WHERE cm.id = i.campaign_id AND cm.manager_id = v_uid AND i.completed_at IS NULL
    AND coalesce(i.status,'') NOT IN ('completed','in_progress')
    AND ((v_e IS NOT NULL AND lower(trim(i.invited_email)) = v_e) OR (v_crew IS NOT NULL AND i.crew_profile_id = v_crew)); GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  RETURN jsonb_build_object('ok', true, 'removed', n);
END $$;
REVOKE ALL ON FUNCTION public.manager_remove_crew_from_pool(text, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.manager_remove_crew_from_pool(text, uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';