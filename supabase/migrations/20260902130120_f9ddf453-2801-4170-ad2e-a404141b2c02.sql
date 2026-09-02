UPDATE public.smc_assessments SET status='abandoned' WHERE status='in_progress' AND started_at < now() - interval '2 days';

CREATE OR REPLACE FUNCTION public.start_or_resume_assessment()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  UPDATE public.smc_assessments
     SET status = 'abandoned'
   WHERE crew_profile_id = v_uid
     AND status = 'in_progress'
     AND started_at < now() - interval '24 hours';

  SELECT id INTO v_id
    FROM public.smc_assessments
   WHERE crew_profile_id = v_uid
     AND status = 'in_progress'
   ORDER BY started_at DESC
   LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'action', 'resume', 'assessment_id', v_id);
  END IF;

  INSERT INTO public.smc_assessments (crew_profile_id, status, current_step, scoring_version)
  VALUES (v_uid, 'in_progress', 1, 'v1.1')
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'action', 'start', 'assessment_id', v_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_or_resume_assessment() TO authenticated;

NOTIFY pgrst,'reload schema';