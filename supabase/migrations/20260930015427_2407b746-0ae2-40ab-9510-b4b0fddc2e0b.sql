CREATE OR REPLACE FUNCTION public.build_daily_notifications()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  n_jobs int := 0; n_cert int := 0;
BEGIN
  WITH fresh AS (
    SELECT rank_group_of(rank_required) AS grp, lower(coalesce(vessel_type,'')) AS vt
    FROM external_vacancies
    WHERE fetched_at > now() - interval '24 hours'
      AND (expires_at IS NULL OR expires_at > now())
  ), m AS (
    SELECT cp.id,
      count(*) FILTER (WHERE f.grp = rank_group_of(cp.rank)) AS n_rank,
      count(*) FILTER (WHERE f.grp = rank_group_of(cp.rank) AND f.vt <> '' AND
        (lower(coalesce(cp.vessel_type,'')) <> '' AND f.vt LIKE '%' || split_part(lower(cp.vessel_type),' ',1) || '%')) AS n_vessel
    FROM crew_profiles cp
    JOIN fresh f ON true
    WHERE cp.job_alerts_enabled IS NOT FALSE
      AND cp.rank IS NOT NULL
      AND (cp.is_available IS TRUE OR cp.available_from IS NULL OR cp.available_from <= current_date + 45)
      AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.crew_id = cp.id AND n.kind = 'jobs_daily'
                      AND n.created_at > now() - interval '20 hours')
    GROUP BY cp.id, cp.rank
    HAVING count(*) FILTER (WHERE f.grp = rank_group_of(cp.rank)) > 0
    LIMIT 5000
  )
  INSERT INTO notifications (crew_id, kind, title, body, icon, screen)
  SELECT m.id, 'jobs_daily',
         '🎯 ' || m.n_rank || ' new job' || CASE WHEN m.n_rank > 1 THEN 's' ELSE '' END || ' match your rank',
         CASE WHEN m.n_vessel > 0 THEN m.n_vessel || ' on your ship type. ' ELSE '' END
           || 'Apply free, no agent fees. Tap to see your matches.',
         '💼', 'home'
  FROM m;
  GET DIAGNOSTICS n_jobs = ROW_COUNT;

  INSERT INTO notifications (crew_id, kind, title, body, icon, screen)
  SELECT DISTINCT ON (cp.id)
         cp.id, 'cert_expiry',
         CASE
           WHEN c.expiry = current_date THEN c.cert_name || ' expires TODAY'
           WHEN c.expiry > current_date THEN c.cert_name || ' expires in ' || (c.expiry - current_date) || ' days'
           ELSE c.cert_name || ' expired ' || (current_date - c.expiry) || ' days ago'
         END,
         'Renew it early — companies filter out crew with expired documents. Tap to review your certificates.',
         '📜', 'resume'
  FROM crew_profiles cp
  JOIN crew_cv_data v ON v.user_id = cp.id
  CROSS JOIN LATERAL (
    SELECT elem->>'name' AS cert_name,
           (coalesce(elem->>'expiryDate', elem->>'expiry_date'))::date AS expiry
    FROM jsonb_array_elements(v.certificates) elem
    WHERE coalesce(elem->>'expiryDate', elem->>'expiry_date') ~ '^\d{4}-\d{2}-\d{2}$'
      AND (coalesce(elem->>'expiryDate', elem->>'expiry_date'))::date
          BETWEEN current_date - 30 AND current_date + 60
    ORDER BY 2 ASC LIMIT 1
  ) c
  WHERE v.certificates IS NOT NULL
    AND jsonb_typeof(v.certificates) = 'array'
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.crew_id = cp.id AND n.kind = 'cert_expiry'
        AND n.created_at > now() - interval '14 days');
  GET DIAGNOSTICS n_cert = ROW_COUNT;

  DELETE FROM notifications WHERE created_at < now() - interval '60 days';
  RETURN format('notifications: jobs=%s certs=%s', n_jobs, n_cert);
EXCEPTION WHEN OTHERS THEN
  RETURN 'skipped: ' || SQLERRM;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_growth_pulse()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
  IF NOT is_admin(auth.uid()) THEN RAISE EXCEPTION 'not authorized'; END IF;
  WITH jobs AS (
    SELECT coalesce(nullif(trim(joining_port),''),'Unknown') AS k,
      count(*) FILTER (WHERE fetched_at > now() - interval '24 hours') d1,
      count(*) d7
    FROM external_vacancies WHERE fetched_at > now() - interval '7 days'
    GROUP BY 1 ORDER BY d7 DESC LIMIT 15
  ), apps AS (
    SELECT coalesce(nullif(trim(cp.nationality),''),'Unknown') AS k,
      count(*) FILTER (WHERE a.created_at > now() - interval '24 hours') d1,
      count(*) d7
    FROM job_applications a LEFT JOIN crew_profiles cp ON cp.id = a.crew_id
    WHERE a.created_at > now() - interval '7 days'
    GROUP BY 1 ORDER BY d7 DESC LIMIT 15
  )
  SELECT jsonb_build_object(
    'jobs_24h', (SELECT count(*) FROM external_vacancies WHERE fetched_at > now() - interval '24 hours'),
    'jobs_7d', (SELECT count(*) FROM external_vacancies WHERE fetched_at > now() - interval '7 days'),
    'apps_24h', (SELECT count(*) FROM job_applications WHERE created_at > now() - interval '24 hours'),
    'apps_7d', (SELECT count(*) FROM job_applications WHERE created_at > now() - interval '7 days'),
    'alerts_24h', (SELECT count(*) FROM notifications WHERE kind='jobs_daily' AND created_at > now() - interval '24 hours'),
    'jobs_by_port', coalesce((SELECT jsonb_agg(jsonb_build_object('k',k,'d1',d1,'d7',d7)) FROM jobs),'[]'),
    'apps_by_nationality', coalesce((SELECT jsonb_agg(jsonb_build_object('k',k,'d1',d1,'d7',d7)) FROM apps),'[]')
  ) INTO r;
  RETURN r;
END; $$;
REVOKE ALL ON FUNCTION public.admin_growth_pulse() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_growth_pulse() TO authenticated;
NOTIFY pgrst, 'reload schema';