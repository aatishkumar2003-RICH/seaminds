ALTER TABLE public.maritime_interview_sessions
  ADD COLUMN framework text NOT NULL DEFAULT 'adaptive_v1',
  ADD COLUMN module_scores jsonb;

CREATE OR REPLACE FUNCTION public.campaign_candidates_v2(p_campaign_id uuid, p_search text DEFAULT NULL, p_status text DEFAULT 'all', p_sort text DEFAULT 'score', p_limit int DEFAULT 25, p_offset int DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE res jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM interview_campaigns c WHERE c.id = p_campaign_id AND (c.manager_id = auth.uid() OR auth.uid() = '492ee966-e015-4440-a415-6ad6275a4a9b'::uuid)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_ALLOWED');
  END IF;
  WITH base AS (
    SELECT i.id AS invite_id, i.status, i.shortlisted, i.cv_request_status, i.created_at AS invited_at,
      COALESCE(i.invited_name, NULLIF(trim(coalesce(cp.first_name,'')||' '||coalesce(cp.last_name,'')),''), 'Candidate') AS name,
      COALESCE(i.invited_whatsapp, cp.whatsapp_number) AS whatsapp, i.invited_email AS email, cp.nationality, cp.role AS rank,
      i.crew_profile_id IS NOT NULL AS signed_in,
      a.overall_score AS overall, a.technical_score AS technical, a.judgment_score AS judgment, a.english_score AS english, a.behavioural_score AS behavioural,
      a.score_band AS band, a.scoring_tier, a.started_at, COALESCE(a.completed_at, i.completed_at) AS completed_at,
      CASE WHEN a.started_at IS NOT NULL AND a.completed_at IS NOT NULL THEN round(extract(epoch FROM (a.completed_at - a.started_at))/60)::int END AS minutes,
      p.question_index, CASE WHEN jsonb_typeof(p.questions)='array' THEN jsonb_array_length(p.questions) END AS question_total, p.last_saved_at,
      COALESCE((SELECT count(*)::int FROM interview_proctor_strikes ps WHERE ps.crew_id = i.crew_profile_id AND ps.created_at > now() - interval '30 days'),0) AS proctor_strikes,
      COALESCE((SELECT count(*)::int FROM jsonb_array_elements(CASE WHEN jsonb_typeof(a.red_flags)='array' THEN a.red_flags ELSE '[]'::jsonb END) f
        WHERE upper(COALESCE(f->>'category','')) NOT IN ('WELLNESS_CONCERN','WELLNESS','MENTAL_HEALTH','FATIGUE','STRESS','FAMILY','MOOD','WELLBEING')),0) AS red_flag_count
    FROM interview_invites i
    LEFT JOIN crew_profiles cp ON cp.id = i.crew_profile_id
    LEFT JOIN smc_assessments r2 ON r2.id = i.round_2_assessment_id AND r2.status='completed' AND r2.overall_score IS NOT NULL
    LEFT JOIN smc_assessments a ON a.id = COALESCE(r2.id, i.assessment_id)
    LEFT JOIN interview_progress p ON p.invite_id = i.id AND p.crew_id = i.crew_profile_id
    WHERE i.campaign_id = p_campaign_id
  ), f AS (
    SELECT * FROM base WHERE (p_search IS NULL OR p_search = '' OR (name||' '||coalesce(email,'')||' '||coalesce(whatsapp,'')||' '||coalesce(nationality,'')||' '||coalesce(rank,'')) ILIKE '%'||p_search||'%')
      AND (CASE coalesce(p_status,'all') WHEN 'completed' THEN status='completed' WHEN 'in_progress' THEN status='in_progress' WHEN 'invited' THEN status NOT IN ('completed','in_progress')
        WHEN 'flags' THEN red_flag_count>0 OR proctor_strikes>0 WHEN 'shortlisted' THEN coalesce(shortlisted,false) ELSE true END)
  )
  SELECT jsonb_build_object('ok', true,
    'total', (SELECT count(*) FROM f),
    'counts', (SELECT jsonb_build_object('all',count(*),'completed',count(*) FILTER (WHERE status='completed'),'in_progress',count(*) FILTER (WHERE status='in_progress'),
       'invited',count(*) FILTER (WHERE status NOT IN ('completed','in_progress')),'flags',count(*) FILTER (WHERE red_flag_count>0 OR proctor_strikes>0),'shortlisted',count(*) FILTER (WHERE coalesce(shortlisted,false))) FROM base),
    'rows', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT * FROM f ORDER BY
       CASE WHEN p_sort='recent' THEN extract(epoch FROM coalesce(completed_at, last_saved_at, invited_at)) END DESC NULLS LAST,
       CASE WHEN p_sort='fastest' THEN minutes END ASC NULLS LAST,
       overall DESC NULLS LAST, invited_at ASC
       LIMIT LEAST(GREATEST(p_limit,1),100) OFFSET GREATEST(p_offset,0)) x), '[]'::jsonb)) INTO res;
  RETURN res;
END $$;

CREATE OR REPLACE FUNCTION public.manager_candidate_dossier(p_invite_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE inv record; a jsonb := '{}'::jsonb; approved boolean; cp jsonb := '{}'::jsonb; sea jsonb := '[]'::jsonb; certs jsonb := '[]'::jsonb; flags jsonb;
BEGIN
  SELECT i.* INTO inv FROM interview_invites i JOIN interview_campaigns c ON c.id=i.campaign_id
   WHERE i.id=p_invite_id AND (c.manager_id=auth.uid() OR auth.uid()='492ee966-e015-4440-a415-6ad6275a4a9b'::uuid);
  IF inv.id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','NOT_ALLOWED'); END IF;
  approved := auth.uid()='492ee966-e015-4440-a415-6ad6275a4a9b'::uuid OR EXISTS(SELECT 1 FROM manager_profiles m WHERE (m.user_id=auth.uid() OR m.id=auth.uid()) AND m.admin_approved);
  SELECT COALESCE(to_jsonb(s),'{}'::jsonb) INTO a FROM smc_assessments s WHERE s.id = COALESCE(inv.round_2_assessment_id, inv.assessment_id);
  a := COALESCE(a,'{}'::jsonb);
  IF inv.crew_profile_id IS NOT NULL THEN
    SELECT jsonb_build_object('first_name',first_name,'last_name',last_name,'role',role,'nationality',nationality,'years_at_sea',years_at_sea,'whatsapp',whatsapp_number,'email',email) INTO cp FROM crew_profiles WHERE id=inv.crew_profile_id;
    cp := COALESCE(cp,'{}'::jsonb);
    IF approved THEN
      SELECT CASE WHEN jsonb_typeof(sea_service)='array' THEN sea_service ELSE '[]'::jsonb END, CASE WHEN jsonb_typeof(certificates)='array' THEN certificates ELSE '[]'::jsonb END
        INTO sea, certs FROM crew_cv_data WHERE user_id=inv.crew_profile_id LIMIT 1;
    END IF;
  END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('category',f->>'category','detail',COALESCE(f->>'detail',f->>'reason',f->>'description',f->>'note'))),'[]'::jsonb) INTO flags
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(a->'red_flags')='array' THEN a->'red_flags' ELSE '[]'::jsonb END) f
    WHERE upper(COALESCE(f->>'category','')) NOT IN ('WELLNESS_CONCERN','WELLNESS','MENTAL_HEALTH','FATIGUE','STRESS','FAMILY','MOOD','WELLBEING');
  RETURN jsonb_build_object('ok',true,'approved',approved,'status',inv.status,'signed_in',inv.crew_profile_id IS NOT NULL,
    'name',COALESCE(inv.invited_name, NULLIF(trim(coalesce(cp->>'first_name','')||' '||coalesce(cp->>'last_name','')),''),'Candidate'),
    'rank',cp->>'role','nationality',cp->>'nationality','years_at_sea',cp->'years_at_sea',
    'email',CASE WHEN approved THEN COALESCE(inv.invited_email,cp->>'email') ELSE inv.invited_email END,
    'whatsapp',CASE WHEN approved THEN COALESCE(inv.invited_whatsapp,cp->>'whatsapp') ELSE inv.invited_whatsapp END,
    'invited_at',inv.created_at,'scheduled_at',inv.scheduled_at,
    'started_at',a->'started_at','completed_at',COALESCE(a->'completed_at',to_jsonb(inv.completed_at)),
    'minutes',CASE WHEN a->>'started_at' IS NOT NULL AND a->>'completed_at' IS NOT NULL THEN round(extract(epoch FROM ((a->>'completed_at')::timestamptz-(a->>'started_at')::timestamptz))/60)::int END,
    'progress',(SELECT jsonb_build_object('question',question_index,'total',CASE WHEN jsonb_typeof(questions)='array' THEN jsonb_array_length(questions) END,'last_saved_at',last_saved_at,'resumed',resumed_count) FROM interview_progress WHERE invite_id=inv.id AND crew_id=inv.crew_profile_id LIMIT 1),
    'scores',CASE WHEN a->>'id' IS NULL THEN NULL ELSE jsonb_build_object('overall',a->'overall_score','technical',a->'technical_score','judgment',a->'judgment_score','english',a->'english_score','behavioural',a->'behavioural_score','experience',a->'experience_score','band',a->'score_band','tier',a->'scoring_tier','round',a->'assessment_round','recommendation',a->'recommendation') END,
    'integrity',jsonb_build_object(
      'strikes',COALESCE((SELECT count(*)::int FROM interview_proctor_strikes ps WHERE ps.crew_id=inv.crew_profile_id AND ps.created_at>now()-interval '30 days'),0),
      'window_days',30,
      'events',COALESCE((SELECT jsonb_agg(jsonb_build_object('reason',reason,'question_no',question_no,'created_at',created_at) ORDER BY created_at DESC) FROM (SELECT reason,question_no,created_at FROM interview_proctor_strikes WHERE crew_id=inv.crew_profile_id AND created_at>now()-interval '30 days' ORDER BY created_at DESC LIMIT 12) recent),'[]'::jsonb)),
    'red_flags',flags,'sea_service',COALESCE(sea,'[]'::jsonb),'certificates',COALESCE(certs,'[]'::jsonb));
END $$;

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
       'completed_at', s.completed_at, 'shared', s.share_with_managers, 'framework', s.framework,
       'technical_pct', CASE WHEN s.share_with_managers THEN s.technical_pct END,
       'module_scores', CASE WHEN s.share_with_managers THEN s.module_scores END,
       'verdict', CASE WHEN s.share_with_managers THEN s.verdict END) ORDER BY s.started_at DESC)
       FROM maritime_interview_sessions s WHERE s.crew_id = r.crew_id), '[]'::jsonb));
END $$;

CREATE FUNCTION public.manager_maritime_report_v2(p_application uuid)
RETURNS TABLE (id uuid, rank text, target_rank text, vessel text, technical_pct integer, safety_flags integer,
               gaps jsonb, verdict text, turns jsonb, completed_at timestamptz, framework text, module_scores jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.rank, s.target_rank, s.vessel, s.technical_pct, s.safety_flags, s.gaps, s.verdict,
         (SELECT coalesce(jsonb_agg(jsonb_build_object('question', t->>'question', 'answer', t->>'answer',
                 'topic', t->>'topic', 'depth', t->'depth', 'safety_flag', t->'safety_flag', 'gap', t->>'gap',
                 'module', t->>'module', 'mode', t->>'mode')), '[]'::jsonb)
            FROM jsonb_array_elements(s.turns) t),
         s.completed_at, s.framework, s.module_scores
    FROM public.job_applications a
    JOIN public.job_postings p ON p.id = a.job_posting_id AND p.manager_id = auth.uid()
    JOIN public.maritime_interview_sessions s ON s.crew_id = a.crew_id
   WHERE a.id = p_application AND s.status = 'completed' AND s.share_with_managers
   ORDER BY s.completed_at DESC
   LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.campaign_candidates_v2(uuid,text,text,text,int,int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.manager_candidate_dossier(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.manager_unified_crew_detail(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.manager_maritime_report_v2(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.campaign_candidates_v2(uuid,text,text,text,int,int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manager_candidate_dossier(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manager_unified_crew_detail(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manager_maritime_report_v2(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';