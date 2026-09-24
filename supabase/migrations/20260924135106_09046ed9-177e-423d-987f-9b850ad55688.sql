CREATE OR REPLACE FUNCTION public.verify_certificate(p_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE a record; lp jsonb;
BEGIN
  SELECT s.certificate_id, s.completed_at, s.overall_score, s.score_band, s.scoring_version,
         s.level_profile, s.technical_score, s.judgment_score, s.english_score, s.behavioural_score,
         cp.first_name, cp.last_name, cp.role
  INTO a
  FROM smc_assessments s JOIN crew_profiles cp ON cp.id = s.crew_profile_id
  WHERE s.status = 'completed' AND s.certificate_id IS NOT NULL
    AND (s.certificate_id = p_id OR s.id::text = p_id)
  ORDER BY s.completed_at DESC NULLS LAST LIMIT 1;

  IF a.certificate_id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_found');
  END IF;

  lp := CASE WHEN jsonb_typeof(a.level_profile) = 'object' THEN a.level_profile ELSE NULL END;

  RETURN jsonb_build_object(
    'valid', true,
    'certificate_id', a.certificate_id,
    'candidate', a.first_name || ' ' || coalesce(left(a.last_name, 1) || '.', ''),
    'rank', a.role,
    'assessed_on', a.completed_at::date,
    'expires_on', (a.completed_at + interval '2 years')::date,
    'expired', a.completed_at + interval '2 years' < now(),
    'score', a.overall_score,
    'band', a.score_band,
    'dimensions', jsonb_build_object(
      'technical', a.technical_score,
      'judgment', a.judgment_score,
      'english', a.english_score,
      'behavioural', a.behavioural_score),
    'level_profile', lp,
    'scoring_version', coalesce(a.scoring_version, 'v1.0'));
END $function$;

NOTIFY pgrst, 'reload schema';