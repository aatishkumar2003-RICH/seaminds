ALTER TABLE public.smc_assessments ADD COLUMN IF NOT EXISTS level_profile jsonb;

DO $$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace ns ON ns.oid = p.pronamespace
    WHERE ns.nspname = 'public'
      AND p.prosecdef
      AND (p.proconfig IS NULL OR NOT EXISTS (
        SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%'
      ))
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', r.sig);
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'search_path set on % functions', n;
END $$;

NOTIFY pgrst, 'reload schema';