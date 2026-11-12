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
        WHEN 'flags' THEN red_flag_count>0 WHEN 'shortlisted' THEN coalesce(shortlisted,false) ELSE true END)
  )
  SELECT jsonb_build_object('ok', true,
    'total', (SELECT count(*) FROM f),
    'counts', (SELECT jsonb_build_object('all',count(*),'completed',count(*) FILTER (WHERE status='completed'),'in_progress',count(*) FILTER (WHERE status='in_progress'),
       'invited',count(*) FILTER (WHERE status NOT IN ('completed','in_progress')),'flags',count(*) FILTER (WHERE red_flag_count>0),'shortlisted',count(*) FILTER (WHERE coalesce(shortlisted,false))) FROM base),
    'rows', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT * FROM f ORDER BY
       CASE WHEN p_sort='recent' THEN extract(epoch FROM coalesce(completed_at, last_saved_at, invited_at)) END DESC NULLS LAST,
       CASE WHEN p_sort='fastest' THEN minutes END ASC NULLS LAST,
       overall DESC NULLS LAST, invited_at ASC
       LIMIT LEAST(GREATEST(p_limit,1),100) OFFSET GREATEST(p_offset,0)) x), '[]'::jsonb)) INTO res;
  RETURN res;
END $$;

CREATE OR REPLACE FUNCTION public.manager_candidate_dossier(p_invite_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE inv record; a record; approved boolean; cv record; cp record;
BEGIN
  SELECT i.* INTO inv FROM interview_invites i JOIN interview_campaigns c ON c.id=i.campaign_id
   WHERE i.id=p_invite_id AND (c.manager_id=auth.uid() OR auth.uid()='492ee966-e015-4440-a415-6ad6275a4a9b'::uuid);
  IF inv.id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','NOT_ALLOWED'); END IF;
  approved := auth.uid()='492ee966-e015-4440-a415-6ad6275a4a9b'::uuid OR EXISTS(SELECT 1 FROM manager_profiles m WHERE (m.user_id=auth.uid() OR m.id=auth.uid()) AND m.admin_approved);
  SELECT * INTO a FROM smc_assessments WHERE id = COALESCE(inv.round_2_assessment_id, inv.assessment_id);
  IF inv.crew_profile_id IS NOT NULL THEN
    SELECT first_name,last_name,role,nationality,years_at_sea,whatsapp_number,email INTO cp FROM crew_profiles WHERE id=inv.crew_profile_id;
    IF approved THEN SELECT sea_service, certificates INTO cv FROM crew_cv_data WHERE user_id=inv.crew_profile_id LIMIT 1; END IF;
  END IF;
  RETURN jsonb_build_object('ok',true,'approved',approved,'status',inv.status,'signed_in',inv.crew_profile_id IS NOT NULL,
    'name',COALESCE(inv.invited_name, NULLIF(trim(coalesce(cp.first_name,'')||' '||coalesce(cp.last_name,'')),''),'Candidate'),
    'rank',cp.role,'nationality',cp.nationality,'years_at_sea',cp.years_at_sea,
    'email',CASE WHEN approved THEN COALESCE(inv.invited_email,cp.email) ELSE inv.invited_email END,
    'whatsapp',CASE WHEN approved THEN COALESCE(inv.invited_whatsapp,cp.whatsapp_number) ELSE inv.invited_whatsapp END,
    'invited_at',inv.created_at,'scheduled_at',inv.scheduled_at,
    'started_at',a.started_at,'completed_at',COALESCE(a.completed_at,inv.completed_at),
    'minutes',CASE WHEN a.started_at IS NOT NULL AND a.completed_at IS NOT NULL THEN round(extract(epoch FROM (a.completed_at-a.started_at))/60)::int END,
    'progress',(SELECT jsonb_build_object('question',question_index,'total',CASE WHEN jsonb_typeof(questions)='array' THEN jsonb_array_length(questions) END,'last_saved_at',last_saved_at,'resumed',resumed_count) FROM interview_progress WHERE invite_id=inv.id AND crew_id=inv.crew_profile_id LIMIT 1),
    'scores',CASE WHEN a.id IS NULL THEN NULL ELSE jsonb_build_object('overall',a.overall_score,'technical',a.technical_score,'judgment',a.judgment_score,'english',a.english_score,'behavioural',a.behavioural_score,'experience',a.experience_score,'band',a.score_band,'tier',a.scoring_tier,'round',a.assessment_round,'recommendation',a.recommendation) END,
    'red_flags',COALESCE((SELECT jsonb_agg(jsonb_build_object('category',f->>'category','detail',COALESCE(f->>'detail',f->>'reason',f->>'description',f->>'note'))) FROM jsonb_array_elements(CASE WHEN jsonb_typeof(a.red_flags)='array' THEN a.red_flags ELSE '[]'::jsonb END) f
       WHERE upper(COALESCE(f->>'category','')) NOT IN ('WELLNESS_CONCERN','WELLNESS','MENTAL_HEALTH','FATIGUE','STRESS','FAMILY','MOOD','WELLBEING')),'[]'::jsonb),
    'sea_service',CASE WHEN jsonb_typeof(cv.sea_service)='array' THEN cv.sea_service ELSE '[]'::jsonb END,
    'certificates',CASE WHEN jsonb_typeof(cv.certificates)='array' THEN cv.certificates ELSE '[]'::jsonb END);
END $$;

REVOKE ALL ON FUNCTION public.campaign_candidates_v2(uuid,text,text,text,int,int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.manager_candidate_dossier(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.campaign_candidates_v2(uuid,text,text,text,int,int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manager_candidate_dossier(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';