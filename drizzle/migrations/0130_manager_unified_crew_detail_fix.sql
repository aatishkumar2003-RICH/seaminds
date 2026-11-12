CREATE OR REPLACE FUNCTION public.manager_unified_crew_detail(p_key text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); r record; v_approved boolean; v_rec company_crew_records;
BEGIN
  SELECT * INTO r FROM public._manager_crew_base(v_uid) b WHERE b.k = p_key;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_LINKED'); END IF;
  SELECT admin_approved INTO v_approved FROM manager_profiles WHERE user_id = v_uid;
  IF r.record_id IS NOT NULL THEN SELECT * INTO v_rec FROM company_crew_records WHERE id = r.record_id; END IF;
  INSERT INTO cv_access_log(manager_user_id, crew_user_id, action) SELECT v_uid, r.crew_id, 'unified_dossier' WHERE r.crew_id IS NOT NULL AND coalesce(v_approved,false);
  RETURN jsonb_build_object('ok', true, 'approved', coalesce(v_approved,false),
    'key', r.k, 'record_id', r.record_id, 'crew_id', r.crew_id, 'name', r.name, 'rank', r.rank, 'nationality', r.nationality,
    'vessel', r.vessel, 'status', r.status, 'sources', r.sources, 'crew_unique_id', r.crew_unique_id,
    'email', CASE WHEN v_approved OR r.record_id IS NOT NULL THEN r.email END,
    'whatsapp', CASE WHEN v_approved OR r.record_id IS NOT NULL THEN r.whatsapp END,
    'cdc_no', v_rec.cdc_no, 'passport_no', v_rec.passport_no, 'date_of_birth', v_rec.date_of_birth,
    'certificates', CASE WHEN v_approved OR r.crew_id IS NULL THEN r.certs ELSE '[]'::jsonb END,
    'sea_service', CASE WHEN v_approved OR r.crew_id IS NULL THEN r.sea ELSE '[]'::jsonb END,
    'contracts', coalesce((SELECT jsonb_agg(jsonb_build_object('vessel', sc.vessel_name, 'status', sc.status, 'start', sc.start_date,
        'months', sc.duration_months, 'currency', sc.currency, 'wage', sc.basic_wage) ORDER BY sc.created_at DESC)
       FROM sea_contracts sc JOIN job_applications ja ON ja.id = sc.application_id
       WHERE ja.crew_id = r.crew_id AND public._crew_desk_app_owned(ja.id)), '[]'::jsonb),
    'english', coalesce((SELECT jsonb_agg(jsonb_build_object('scenario', scenario_id, 'score', score, 'at', created_at) ORDER BY created_at DESC)
       FROM (SELECT * FROM english_attempts WHERE user_id = r.crew_id ORDER BY created_at DESC LIMIT 60) e), '[]'::jsonb),
    'modules', coalesce((SELECT jsonb_agg(jsonb_build_object('title', m.title, 'status', a.status, 'quiz_correct', a.quiz_correct,
       'quiz_total', a.quiz_total, 'completed_at', a.completed_at) ORDER BY coalesce(a.completed_at, a.created_at) DESC)
       FROM crew_training_assignments a JOIN training_modules m ON m.id = a.module_id WHERE a.crew_id = r.crew_id), '[]'::jsonb),
    'interviews', coalesce((SELECT jsonb_agg(jsonb_build_object('status', s.status, 'rank', s.rank, 'started_at', s.started_at,
       'completed_at', s.completed_at, 'shared', s.share_with_managers,
       'technical_pct', CASE WHEN s.share_with_managers THEN s.technical_pct END,
       'verdict', CASE WHEN s.share_with_managers THEN s.verdict END) ORDER BY s.started_at DESC)
       FROM maritime_interview_sessions s WHERE s.crew_id = r.crew_id), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.manager_unified_crew_detail(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manager_unified_crew_detail(text) TO authenticated;
NOTIFY pgrst, 'reload schema';