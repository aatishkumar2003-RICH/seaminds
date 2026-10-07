DROP FUNCTION IF EXISTS public.campaign_leaderboard(uuid);
CREATE FUNCTION public.campaign_leaderboard(p_campaign_id uuid)
 RETURNS TABLE(invite_id uuid, token text, name text, whatsapp text, nationality text, status text, overall numeric, technical numeric, english numeric, behavioural numeric, wellness numeric, band text, red_flag_count integer, shortlisted boolean, completed_at timestamp with time zone, scoring_tier text, cv_request_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM interview_campaigns c WHERE c.id = p_campaign_id AND c.manager_id = auth.uid()) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT i.id, i.token,
         COALESCE(i.invited_name, cp.first_name, 'Candidate'),
         COALESCE(i.invited_whatsapp, cp.whatsapp_number),
         cp.nationality,
         i.status,
         a.overall_score, a.technical_score, a.english_score,
         a.behavioural_score, a.wellness_score, a.score_band,
         COALESCE((
           SELECT count(*)::int FROM jsonb_array_elements(a.red_flags) f
           WHERE jsonb_typeof(a.red_flags) = 'array'
             AND upper(COALESCE(f->>'category','')) NOT IN (
               'WELLNESS_CONCERN','WELLNESS','MENTAL_HEALTH','FATIGUE','STRESS','FAMILY','MOOD','WELLBEING'
             )
         ), 0),
         i.shortlisted, i.completed_at,
         a.scoring_tier, i.cv_request_status
  FROM interview_invites i
  LEFT JOIN crew_profiles cp ON cp.id = i.crew_profile_id
  LEFT JOIN smc_assessments r1 ON r1.id = i.assessment_id
  LEFT JOIN LATERAL (
    SELECT r2.id FROM smc_assessments r2
    WHERE i.cv_request_status IS NOT NULL
      AND i.crew_profile_id IS NOT NULL
      AND r2.crew_profile_id = i.crew_profile_id
      AND r2.status = 'completed'
      AND r2.scoring_tier = 'CV_VERIFIED'
      AND r2.overall_score IS NOT NULL
      AND r2.completed_at > COALESCE(i.completed_at, r1.completed_at)
    ORDER BY r2.completed_at DESC LIMIT 1
  ) rr ON true
  LEFT JOIN smc_assessments a ON a.id = COALESCE(rr.id, i.assessment_id)
  WHERE i.campaign_id = p_campaign_id
  ORDER BY a.overall_score DESC NULLS LAST, i.created_at ASC;
END; $function$;
GRANT EXECUTE ON FUNCTION public.campaign_leaderboard(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';