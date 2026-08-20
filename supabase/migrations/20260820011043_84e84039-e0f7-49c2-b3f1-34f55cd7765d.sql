ALTER TABLE public.smc_assessments ADD COLUMN IF NOT EXISTS interview_mode text DEFAULT 'self';

CREATE OR REPLACE FUNCTION public.campaign_leaderboard(p_campaign_id uuid)
 RETURNS TABLE(invite_id uuid, token text, name text, whatsapp text, nationality text, status text, overall numeric, technical numeric, english numeric, behavioural numeric, wellness numeric, band text, red_flag_count integer, shortlisted boolean, completed_at timestamp with time zone)
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
         i.shortlisted, i.completed_at
  FROM interview_invites i
  LEFT JOIN crew_profiles cp ON cp.id = i.crew_profile_id
  LEFT JOIN smc_assessments a ON a.id = i.assessment_id
  WHERE i.campaign_id = p_campaign_id
  ORDER BY a.overall_score DESC NULLS LAST, i.created_at ASC;
END; $function$;