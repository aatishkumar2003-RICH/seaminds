-- Drop the overly permissive public read policy if it exists
DROP POLICY IF EXISTS read_question_bank ON public.question_bank;

-- Revoke direct client access to the underlying table
REVOKE ALL ON public.question_bank FROM anon, authenticated;
GRANT ALL ON public.question_bank TO service_role;

-- Ensure RLS is enabled
ALTER TABLE public.question_bank ENABLE ROW LEVEL SECURITY;

-- Service role can do everything on the table
DROP POLICY IF EXISTS "Service role full access on question_bank" ON public.question_bank;
CREATE POLICY "Service role full access on question_bank"
  ON public.question_bank
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Public view that strips out answer-related columns
CREATE OR REPLACE VIEW public.question_bank_public AS
SELECT
  id,
  rank_group,
  domain,
  vessel_type,
  question,
  options,
  regulation,
  difficulty,
  rank_specific,
  active,
  times_used,
  created_at
FROM public.question_bank
WHERE active = true;

-- Grant public/select on the sanitized view
GRANT SELECT ON public.question_bank_public TO anon, authenticated;
