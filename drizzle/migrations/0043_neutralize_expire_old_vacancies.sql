CREATE OR REPLACE FUNCTION public.expire_old_vacancies()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Owner policy: vacancies are retained until an authorized human cleans them up.
  -- This function intentionally performs no deletion, expiration or status updates.
  RETURN 'disabled: automatic vacancy cleanup is off by owner policy';
END $$;
COMMENT ON FUNCTION public.expire_old_vacancies() IS 'NEUTRALIZED: no-op by owner policy (manual vacancy cleanup only).';