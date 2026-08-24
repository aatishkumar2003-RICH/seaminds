UPDATE public.job_postings SET verified = true WHERE status = 'active' AND verified = false AND (manager_id IS NULL OR EXISTS (SELECT 1 FROM public.manager_profiles mp WHERE mp.user_id = job_postings.manager_id AND coalesce(mp.admin_approved,false) = true));

CREATE OR REPLACE FUNCTION public.auto_verify_manager_posting()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.manager_profiles mp
    WHERE mp.user_id = auth.uid() AND coalesce(mp.admin_approved,false) = true) THEN
    NEW.verified := true;
    NEW.manager_id := coalesce(NEW.manager_id, auth.uid());
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_auto_verify_posting ON public.job_postings;
CREATE TRIGGER trg_auto_verify_posting BEFORE INSERT ON public.job_postings
FOR EACH ROW EXECUTE FUNCTION public.auto_verify_manager_posting();

DROP POLICY IF EXISTS "managers_read_own_postings" ON public.job_postings;
CREATE POLICY "managers_read_own_postings" ON public.job_postings
FOR SELECT TO authenticated USING (manager_id = auth.uid());