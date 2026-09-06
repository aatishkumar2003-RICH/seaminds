DROP POLICY IF EXISTS "crew_manages_own_answers" ON public.interview_answers;

CREATE POLICY "crew_insert_own_answers" ON public.interview_answers FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.smc_assessments a WHERE a.id = interview_answers.assessment_id AND a.crew_profile_id = auth.uid() AND a.status = 'in_progress'));

CREATE POLICY "crew_read_own_answers" ON public.interview_answers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.smc_assessments a WHERE a.id = interview_answers.assessment_id AND a.crew_profile_id = auth.uid()));

DROP POLICY IF EXISTS "crew_update_smc_non_scoring" ON public.smc_assessments;

CREATE OR REPLACE FUNCTION public.guard_assessment_scoring() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin(auth.uid()) THEN
    NEW.overall_score := OLD.overall_score;
    NEW.score_band := OLD.score_band;
    NEW.certificate_id := OLD.certificate_id;
    NEW.scoring_version := OLD.scoring_version;
    NEW.completed_at := OLD.completed_at;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_assessment_scoring ON public.smc_assessments;
CREATE TRIGGER trg_guard_assessment_scoring BEFORE UPDATE ON public.smc_assessments
FOR EACH ROW EXECUTE FUNCTION public.guard_assessment_scoring();

CREATE POLICY "crew_update_own_assessment_progress" ON public.smc_assessments FOR UPDATE TO authenticated
  USING (crew_profile_id = auth.uid()) WITH CHECK (crew_profile_id = auth.uid());

NOTIFY pgrst,'reload schema';