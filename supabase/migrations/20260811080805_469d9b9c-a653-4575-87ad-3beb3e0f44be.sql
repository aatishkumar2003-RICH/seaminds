ALTER POLICY "Users can insert own smc_assessments"
ON public.smc_assessments
WITH CHECK (
  owns_crew_profile(crew_profile_id)
  AND overall_score IS NULL
  AND score_band IS NULL
  AND certificate_id IS NULL
  AND recommendation IS NULL
  AND dimension_scores IS NULL
  AND technical_score IS NULL
  AND english_score IS NULL
  AND experience_score IS NULL
  AND behavioural_score IS NULL
  AND wellness_score IS NULL
  AND judgment_score IS NULL
);

ALTER POLICY "crew_insert_assessment"
ON public.smc_assessments
WITH CHECK (
  crew_profile_id = auth.uid()
  AND overall_score IS NULL
  AND score_band IS NULL
  AND certificate_id IS NULL
  AND recommendation IS NULL
  AND dimension_scores IS NULL
  AND technical_score IS NULL
  AND english_score IS NULL
  AND experience_score IS NULL
  AND behavioural_score IS NULL
  AND wellness_score IS NULL
  AND judgment_score IS NULL
);