-- Free growth phase: any registered manager may publish vacancies; crew search stays approval-gated.
CREATE OR REPLACE FUNCTION public.auto_verify_manager_posting()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.manager_profiles mp WHERE mp.user_id = auth.uid()) THEN
    NEW.verified := true;
    NEW.manager_id := coalesce(NEW.manager_id, auth.uid());
  END IF;
  RETURN NEW;
END $$;

UPDATE public.job_postings jp SET verified = true
WHERE jp.status = 'active' AND jp.verified = false
  AND EXISTS (SELECT 1 FROM public.manager_profiles mp WHERE mp.user_id = jp.manager_id);

NOTIFY pgrst, 'reload schema';
