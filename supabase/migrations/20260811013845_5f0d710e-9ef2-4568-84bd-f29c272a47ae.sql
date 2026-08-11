DROP POLICY IF EXISTS "Anyone can insert job_postings" ON public.job_postings;

CREATE POLICY "Authenticated users can insert job postings"
ON public.job_postings
FOR INSERT
TO authenticated
WITH CHECK (
  status IN ('active', 'pending_payment')
  AND verified = false
  AND (telegram_posted = false OR telegram_posted IS NULL)
);