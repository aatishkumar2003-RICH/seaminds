CREATE OR REPLACE FUNCTION public.get_market_indices()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH live AS (
  SELECT
    rank_required,
    vessel_type,
    joining_port,
    (COALESCE(first_seen_at, fetched_at, created_at) > now() - interval '24 hours') AS is_new,
    CASE
      WHEN COALESCE(rank_required,'') ~* '(eto|electro)' THEN 'ETO'
      WHEN COALESCE(rank_required,'') ~* '(engineer|motorman|oiler|fitter|engine)' THEN 'ENGINE'
      WHEN COALESCE(vessel_type,'') ~* '(offshore|ahts|psv|rig|drill|jack)' THEN 'OFFSHORE'
      WHEN COALESCE(rank_required,'') ~* '(cook|steward|catering|messman|chef)' THEN 'CATERING'
      WHEN COALESCE(rank_required,'') ~* '(master|captain|officer|deck|bosun|able seaman|ab |os |cadet)' THEN 'DECK'
      ELSE 'OTHER'
    END AS dept
  FROM external_vacancies
  WHERE expires_at > now() AND COALESCE(is_scam_flagged,false) = false
)
SELECT jsonb_build_object(
  'total', (SELECT count(*) FROM live),
  'new_24h', (SELECT count(*) FROM live WHERE is_new),
  'countries', (SELECT count(DISTINCT btrim(split_part(joining_port, ',', -1))) FROM live WHERE COALESCE(joining_port,'') <> ''),
  'indices', COALESCE((
    SELECT jsonb_agg(x ORDER BY x->>'name')
    FROM (
      SELECT jsonb_build_object(
        'name', dept,
        'total', count(*),
        'new_24h', count(*) FILTER (WHERE is_new),
        'direction', CASE WHEN count(*) FILTER (WHERE is_new) > 0 THEN 'up' ELSE 'flat' END,
        'status', CASE
          WHEN count(*) FILTER (WHERE is_new) >= 5 THEN 'RISING'
          WHEN count(*) FILTER (WHERE is_new) > 0 THEN 'ACTIVE'
          ELSE 'STABLE' END
      ) AS x
      FROM live
      WHERE dept <> 'OTHER'
      GROUP BY dept
    ) s
  ), '[]'::jsonb),
  'top_ranks', COALESCE((
    SELECT jsonb_agg(r ORDER BY c DESC)
    FROM (
      SELECT rank_required AS r, count(*) AS c
      FROM live
      WHERE COALESCE(rank_required,'') <> ''
      GROUP BY rank_required
      ORDER BY c DESC
      LIMIT 5
    ) t
  ), '[]'::jsonb),
  'top_ranks_counted', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('rank', r, 'count', c) ORDER BY c DESC)
    FROM (
      SELECT rank_required AS r, count(*) AS c
      FROM live
      WHERE COALESCE(rank_required,'') <> ''
      GROUP BY rank_required
      ORDER BY c DESC
      LIMIT 6
    ) t2
  ), '[]'::jsonb),
  'generated_at', now()
);
$$;

GRANT EXECUTE ON FUNCTION public.get_market_indices() TO anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';