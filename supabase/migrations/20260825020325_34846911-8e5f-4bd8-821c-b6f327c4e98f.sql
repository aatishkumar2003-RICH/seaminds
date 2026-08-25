DROP POLICY IF EXISTS "Authenticated users can insert job postings" ON public.job_postings;

CREATE POLICY "Authenticated users can insert job postings" ON public.job_postings
FOR INSERT TO authenticated
WITH CHECK (
  (status = ANY (ARRAY['active'::text,'pending_payment'::text]))
  AND ((telegram_posted = false) OR (telegram_posted IS NULL))
  AND (verified = false OR EXISTS (
        SELECT 1 FROM public.manager_profiles mp
        WHERE mp.user_id = auth.uid() AND coalesce(mp.admin_approved,false) = true))
);

NOTIFY pgrst, 'reload schema';