CREATE OR REPLACE FUNCTION public.manager_training_radar(p_search text DEFAULT '', p_offset int DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_ok boolean; v_rows jsonb; v_total int;
BEGIN
  SELECT coalesce(admin_approved, false) INTO v_ok FROM manager_profiles WHERE user_id = v_uid;
  IF v_ok IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_MANAGER'); END IF;
  CREATE TEMP TABLE IF NOT EXISTS _mtr ON COMMIT DROP AS SELECT NULL::jsonb r, NULL::timestamptz la LIMIT 0;
  SELECT count(*) INTO v_total FROM manager_training_links l JOIN crew_profiles p ON p.id = l.crew_id
    WHERE l.manager_id = v_uid
      AND (coalesce(p_search,'') = '' OR (coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')||' '||coalesce(p.rank,'')||' '||coalesce(p.email,'')) ILIKE '%'||p_search||'%');
  SELECT coalesce(jsonb_agg(z.r ORDER BY z.la DESC NULLS LAST), '[]'::jsonb) INTO v_rows FROM (
    SELECT s.la, jsonb_build_object(
      'crew_id', s.crew_id, 'name', trim(coalesce(s.first_name,'')||' '||coalesce(s.last_name,'')), 'rank', s.rank,
      'email', CASE WHEN v_ok THEN s.email END, 'whatsapp', CASE WHEN v_ok THEN s.whatsapp_number END,
      'linked_at', s.linked_at, 'eng_attempts', s.eng_n, 'eng_24h', s.eng_24h, 'eng_avg', s.eng_avg, 'eng_best', s.eng_best,
      'eng_last', s.eng_last, 'eng_scenario', s.eng_scenario, 'modules_done', s.mod_done, 'modules_total', s.mod_total,
      'interviews', s.int_n, 'last_active', s.la) r
    FROM (
      SELECT b.*, GREATEST(b.eng_last, b.mod_last, b.int_last, b.last_seen) la FROM (
        SELECT l.crew_id, l.created_at linked_at, p.first_name, p.last_name, p.rank, p.email, p.whatsapp_number, p.last_seen,
          (SELECT count(*) FROM english_attempts e WHERE e.user_id = l.crew_id) eng_n,
          (SELECT count(*) FROM english_attempts e WHERE e.user_id = l.crew_id AND e.created_at > now() - interval '24 hours') eng_24h,
          (SELECT round(avg(x.score)) FROM (SELECT score FROM english_attempts e WHERE e.user_id = l.crew_id ORDER BY created_at DESC LIMIT 10) x) eng_avg,
          (SELECT max(score) FROM english_attempts e WHERE e.user_id = l.crew_id) eng_best,
          (SELECT max(created_at) FROM english_attempts e WHERE e.user_id = l.crew_id) eng_last,
          (SELECT scenario_id FROM english_attempts e WHERE e.user_id = l.crew_id ORDER BY created_at DESC LIMIT 1) eng_scenario,
          (SELECT count(*) FROM crew_training_assignments a WHERE a.crew_id = l.crew_id AND a.status = 'completed') mod_done,
          (SELECT count(*) FROM crew_training_assignments a WHERE a.crew_id = l.crew_id) mod_total,
          (SELECT max(coalesce(completed_at, last_attempt_at, opened_at, created_at)) FROM crew_training_assignments a WHERE a.crew_id = l.crew_id) mod_last,
          (SELECT count(*) FROM maritime_interview_sessions m WHERE m.crew_id = l.crew_id) int_n,
          (SELECT max(updated_at) FROM maritime_interview_sessions m WHERE m.crew_id = l.crew_id) int_last
        FROM manager_training_links l JOIN crew_profiles p ON p.id = l.crew_id
        WHERE l.manager_id = v_uid
          AND (coalesce(p_search,'') = '' OR (coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')||' '||coalesce(p.rank,'')||' '||coalesce(p.email,'')) ILIKE '%'||p_search||'%')
      ) b ORDER BY la DESC NULLS LAST OFFSET greatest(coalesce(p_offset,0),0) LIMIT 25
    ) s
  ) z;
  RETURN jsonb_build_object('ok', true, 'approved', v_ok, 'total', coalesce(v_total,0), 'rows', v_rows);
END $$;