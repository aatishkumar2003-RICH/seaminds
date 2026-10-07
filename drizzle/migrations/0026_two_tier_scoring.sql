ALTER TABLE public.smc_assessments
  ADD COLUMN IF NOT EXISTS scoring_tier text NOT NULL DEFAULT 'QUICK_PROFILE',
  ADD COLUMN IF NOT EXISTS assessment_round smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_assessment_id uuid REFERENCES public.smc_assessments(id) ON DELETE SET NULL;
ALTER TABLE public.smc_assessments
  ADD CONSTRAINT smc_assessments_scoring_tier_chk CHECK (scoring_tier IN ('QUICK_PROFILE','CV_VERIFIED')),
  ADD CONSTRAINT smc_assessments_round_chk CHECK (assessment_round IN (1,2));

ALTER TABLE public.interview_invites
  ADD COLUMN IF NOT EXISTS cv_request_status text NOT NULL DEFAULT 'NONE';
ALTER TABLE public.interview_invites
  ADD CONSTRAINT interview_invites_cv_request_chk CHECK (cv_request_status IN ('NONE','REQUESTED','SUBMITTED','EVALUATED'));

-- Tier is server-derived at creation from the candidate's stored CV; the client cannot choose it.
CREATE OR REPLACE FUNCTION public.set_assessment_scoring_tier()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE has_cv boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.crew_cv_data c
    WHERE c.user_id = NEW.crew_profile_id
      AND ((jsonb_typeof(c.certificates) = 'array' AND jsonb_array_length(c.certificates) > 0)
        OR (jsonb_typeof(c.sea_service) = 'array' AND jsonb_array_length(c.sea_service) > 0))
  ) INTO has_cv;
  NEW.scoring_tier := CASE WHEN has_cv THEN 'CV_VERIFIED' ELSE 'QUICK_PROFILE' END;
  IF TG_OP = 'INSERT' THEN
    NEW.assessment_round := CASE WHEN NEW.parent_assessment_id IS NOT NULL THEN 2 ELSE 1 END;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_set_assessment_scoring_tier ON public.smc_assessments;
CREATE TRIGGER trg_set_assessment_scoring_tier
  BEFORE INSERT ON public.smc_assessments
  FOR EACH ROW EXECUTE FUNCTION public.set_assessment_scoring_tier();