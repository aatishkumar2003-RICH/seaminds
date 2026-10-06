CREATE OR REPLACE FUNCTION public.resolve_canonical_rank(p_rank text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  n text := ' ' || trim(regexp_replace(lower(coalesce(p_rank,'')), '[^a-z0-9]+', ' ', 'g')) || ' ';
  cnt int; r record;
BEGIN
  IF trim(n) = '' THEN RETURN jsonb_build_object('ok', false, 'error_code', 'UNRESOLVED_RANK'); END IF;
  CREATE TEMP TABLE IF NOT EXISTS _rk(p text, canonical_rank text, department text, department_label text, rank_group text, level text) ON COMMIT DROP;
  DELETE FROM _rk;
  INSERT INTO _rk
  SELECT p, canonical_rank, department, department_label, rank_group, level FROM (
    SELECT trim(regexp_replace(rank_pattern, '[^a-z0-9]+', ' ', 'g')) p, * FROM rank_taxonomy WHERE canonical_rank IS NOT NULL
  ) t WHERE p <> '' AND position(' ' || p || ' ' in n) > 0;
  -- drop matches that are only part of a longer matched phrase (e.g. "cook" inside "2nd cook")
  DELETE FROM _rk x WHERE EXISTS (SELECT 1 FROM _rk y WHERE length(y.p) > length(x.p) AND position(' ' || x.p || ' ' in ' ' || y.p || ' ') > 0);
  SELECT count(DISTINCT canonical_rank) INTO cnt FROM _rk;
  IF cnt = 0 THEN RETURN jsonb_build_object('ok', false, 'error_code', 'UNRESOLVED_RANK'); END IF;
  IF cnt > 1 THEN RETURN jsonb_build_object('ok', false, 'error_code', 'AMBIGUOUS_RANK'); END IF;
  SELECT * INTO r FROM _rk LIMIT 1;
  RETURN jsonb_build_object('ok', true, 'canonical_rank', r.canonical_rank, 'department', r.department_label,
    'department_code', r.department, 'level', r.level, 'rank_group', r.rank_group);
END $$;
NOTIFY pgrst, 'reload schema';