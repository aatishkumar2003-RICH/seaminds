CREATE OR REPLACE FUNCTION public.resolve_canonical_rank(p_rank text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  n text := ' ' || trim(regexp_replace(lower(coalesce(p_rank,'')), '[^a-z0-9]+', ' ', 'g')) || ' ';
  cnt int; v_c text; v_d text; v_dl text; v_g text; v_l text;
BEGIN
  IF trim(n) = '' THEN RETURN jsonb_build_object('ok', false, 'error_code', 'UNRESOLVED_RANK'); END IF;
  WITH m AS (
    SELECT t.* FROM (
      SELECT trim(regexp_replace(rank_pattern, '[^a-z0-9]+', ' ', 'g')) p, canonical_rank, department, department_label, rank_group, level
      FROM rank_taxonomy WHERE canonical_rank IS NOT NULL
    ) t WHERE t.p <> '' AND position(' ' || t.p || ' ' in n) > 0
  ), k AS (
    SELECT x.* FROM m x WHERE NOT EXISTS (
      SELECT 1 FROM m y WHERE length(y.p) > length(x.p) AND position(' ' || x.p || ' ' in ' ' || y.p || ' ') > 0)
  )
  SELECT (SELECT count(DISTINCT canonical_rank) FROM k), k.canonical_rank, k.department, k.department_label, k.rank_group, k.level
    INTO cnt, v_c, v_d, v_dl, v_g, v_l
    FROM k LIMIT 1;
  IF cnt IS NULL OR cnt = 0 THEN RETURN jsonb_build_object('ok', false, 'error_code', 'UNRESOLVED_RANK'); END IF;
  IF cnt > 1 THEN RETURN jsonb_build_object('ok', false, 'error_code', 'AMBIGUOUS_RANK'); END IF;
  RETURN jsonb_build_object('ok', true, 'canonical_rank', v_c, 'department', v_dl,
    'department_code', v_d, 'level', v_l, 'rank_group', v_g);
END $$;
NOTIFY pgrst, 'reload schema';