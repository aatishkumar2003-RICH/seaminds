-- Recreate the public view as SECURITY INVOKER (default behavior, explicit for linter)
CREATE OR REPLACE VIEW public.question_bank_public
WITH (security_invoker = true)
AS
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

-- Ensure grants remain
GRANT SELECT ON public.question_bank_public TO anon, authenticated;
