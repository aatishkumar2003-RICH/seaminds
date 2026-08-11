DROP POLICY IF EXISTS "Anyone can read job_postings" ON public.job_postings;

CREATE POLICY "Public can read active verified job_postings"
ON public.job_postings
FOR SELECT
TO anon, authenticated
USING (
  status = 'active'
  AND verified = true
);