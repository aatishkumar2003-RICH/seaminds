CREATE OR REPLACE FUNCTION public.smc_assessments_sanitize_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- Force a fresh, unscored assessment. Scoring/certificate/recommendation data
  -- must only be written by the trusted scoring pipeline, never by the client on create.
  NEW.status := 'in_progress';
  NEW.current_step := 1;
  NEW.doc_upload_status := 'pending';
  NEW.technical_score := NULL;
  NEW.english_score := NULL;
  NEW.experience_score := NULL;
  NEW.behavioural_score := NULL;
  NEW.wellness_score := NULL;
  NEW.judgment_score := NULL;
  NEW.overall_score := NULL;
  NEW.score_band := NULL;
  NEW.certificate_id := NULL;
  NEW.recommendation := NULL;
  NEW.dimension_scores := NULL;
  NEW.red_flags := '[]'::jsonb;
  NEW.report := NULL;
  NEW.completed_at := NULL;
  NEW.scoring_version := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS smc_assessments_sanitize_insert_trigger ON public.smc_assessments;
CREATE TRIGGER smc_assessments_sanitize_insert_trigger
BEFORE INSERT ON public.smc_assessments
FOR EACH ROW
EXECUTE FUNCTION public.smc_assessments_sanitize_insert();