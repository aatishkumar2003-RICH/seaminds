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
    'red_flags',flags,'sea_service',COALESCE(sea,'[]'::jsonb),'certificates',COALESCE(certs,'[]'::jsonb));
END $$;
NOTIFY pgrst, 'reload schema';