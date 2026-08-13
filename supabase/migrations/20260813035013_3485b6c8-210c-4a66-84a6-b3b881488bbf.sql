DROP POLICY IF EXISTS manager_read_assessment_scoped ON public.smc_assessments;

CREATE POLICY manager_read_assessment_scoped
ON public.smc_assessments
FOR SELECT
TO authenticated
USING (
  public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.manager_profiles mp
    WHERE mp.user_id = auth.uid()
      AND (
        EXISTS (
          SELECT 1 FROM public.contact_requests cr
          WHERE cr.crew_profile_id = smc_assessments.crew_profile_id
            AND cr.manager_profile_id = mp.id
            AND cr.status = 'accepted'
        )
        OR EXISTS (
          SELECT 1
          FROM public.job_vacancies jv
          JOIN public.contact_requests cr2 ON cr2.vacancy_id = jv.id
          WHERE cr2.crew_profile_id = smc_assessments.crew_profile_id
            AND jv.manager_profile_id = mp.id
            AND cr2.status = 'accepted'
        )
      )
  )
);