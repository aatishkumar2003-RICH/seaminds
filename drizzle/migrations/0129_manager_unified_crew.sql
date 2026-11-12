CREATE OR REPLACE FUNCTION public._cert_min_days(p jsonb)
RETURNS TABLE(total int, exp30 int, exp90 int, expired int) LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  WITH d AS (
    SELECT CASE WHEN x ~ '^\d{4}-\d{2}-\d{2}' THEN (substr(x,1,10)::date - current_date) END AS days
    FROM (SELECT coalesce(e->>'expiry_date', e->>'expiryDate', e->>'expiry', '') x
          FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p)='array' THEN p ELSE '[]'::jsonb END) e
          WHERE jsonb_typeof(e)='object') s)
  SELECT count(*)::int, count(*) FILTER (WHERE days BETWEEN 0 AND 30)::int,
         count(*) FILTER (WHERE days BETWEEN 0 AND 90)::int, count(*) FILTER (WHERE days < 0)::int FROM d;
$$;

CREATE OR REPLACE FUNCTION public._manager_crew_base(v_uid uuid)
RETURNS TABLE(k text, record_id uuid, crew_id uuid, name text, rank text, nationality text, vessel text,
  status text, sources text[], email text, whatsapp text, crew_unique_id text, certs jsonb, sea jsonb, added_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH src AS (
    SELECT coalesce(r.crew_id::text, 'r:'||r.id) k, r.id record_id, r.crew_id,
      trim(r.first_name||' '||coalesce(r.last_name,'')) name, r.rank, r.nationality, r.vessel,
      r.status, 'company'::text s, r.email, r.whatsapp, r.crew_unique_id, r.certificates certs, r.sea_service sea, r.created_at at, 1 pri
    FROM company_crew_records r WHERE r.manager_id = v_uid
    UNION ALL
    SELECT l.crew_id::text, NULL, l.crew_id, trim(coalesce(cp.first_name,'')||' '||coalesce(cp.last_name,'')), cp.role, cp.nationality, NULL,
      'training', 'training', cp.email, cp.whatsapp_number, cp.crew_unique_id, NULL, NULL, l.created_at, 2
    FROM manager_training_links l JOIN crew_profiles cp ON cp.id = l.crew_id WHERE l.manager_id = v_uid
    UNION ALL
    SELECT ja.crew_id::text, NULL, ja.crew_id, trim(coalesce(cp.first_name,'')||' '||coalesce(cp.last_name,'')), coalesce(cp.role, ja.rank_applied), cp.nationality,
      coalesce((SELECT sc.vessel_name FROM sea_contracts sc WHERE sc.application_id = ja.id AND sc.status IN ('issued','signed') ORDER BY sc.created_at DESC LIMIT 1), ja.vessel_type),
      CASE WHEN ja.outcome='placed' THEN 'onboard' ELSE 'joining' END, 'joining', cp.email, cp.whatsapp_number, cp.crew_unique_id, NULL, NULL, ja.created_at, 0
    FROM job_applications ja JOIN crew_profiles cp ON cp.id = ja.crew_id
    WHERE ja.outcome IN ('accepted','placed') AND (ja.crew_accepted_at IS NOT NULL OR ja.outcome='placed') AND public._crew_desk_app_owned(ja.id)
  ), agg AS (
    SELECT k, array_agg(DISTINCT s) sources,
      (array_agg(record_id) FILTER (WHERE record_id IS NOT NULL))[1] record_id,
      (array_agg(crew_id) FILTER (WHERE crew_id IS NOT NULL))[1] crew_id,
      (array_agg(name ORDER BY pri) FILTER (WHERE coalesce(name,'')<>''))[1] name,
      (array_agg(rank ORDER BY pri) FILTER (WHERE rank IS NOT NULL))[1] rank,
      (array_agg(nationality ORDER BY pri) FILTER (WHERE nationality IS NOT NULL))[1] nationality,
      (array_agg(vessel ORDER BY pri) FILTER (WHERE coalesce(vessel,'')<>''))[1] vessel,
      (array_agg(status ORDER BY pri))[1] status,
      (array_agg(email ORDER BY pri) FILTER (WHERE email IS NOT NULL))[1] email,
      (array_agg(whatsapp ORDER BY pri) FILTER (WHERE whatsapp IS NOT NULL))[1] whatsapp,
      (array_agg(crew_unique_id ORDER BY pri) FILTER (WHERE crew_unique_id IS NOT NULL))[1] crew_unique_id,
      (array_agg(certs) FILTER (WHERE certs IS NOT NULL))[1] rcerts,
      (array_agg(sea) FILTER (WHERE sea IS NOT NULL))[1] rsea,
      min(at) added_at
    FROM src GROUP BY k)
  SELECT a.k, a.record_id, a.crew_id, a.name, a.rank, a.nationality, a.vessel, a.status, a.sources, a.email, a.whatsapp, a.crew_unique_id,
    CASE WHEN jsonb_typeof(d.certificates)='array' AND jsonb_array_length(d.certificates) > 0 THEN d.certificates ELSE coalesce(a.rcerts,'[]'::jsonb) END,
    CASE WHEN jsonb_typeof(d.sea_service)='array' AND jsonb_array_length(d.sea_service) > 0 THEN d.sea_service ELSE coalesce(a.rsea,'[]'::jsonb) END,
    a.added_at
  FROM agg a LEFT JOIN crew_cv_data d ON d.user_id = a.crew_id;
$$;
REVOKE ALL ON FUNCTION public._manager_crew_base(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.manager_unified_crew(p_search text DEFAULT '', p_filter text DEFAULT 'all', p_vessel text DEFAULT '', p_offset int DEFAULT 0, p_limit int DEFAULT 25)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_res jsonb;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM manager_profiles WHERE user_id = v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_MANAGER'); END IF;
  p_limit := least(greatest(coalesce(p_limit,25),1),100); p_offset := greatest(coalesce(p_offset,0),0);
  WITH b AS (
    SELECT b.*, c.total ct, c.exp30, c.exp90, c.expired,
      (SELECT max(created_at) FROM english_attempts e WHERE e.user_id = b.crew_id) eng_last,
      (SELECT round(avg(score)) FROM (SELECT score FROM english_attempts e WHERE e.user_id = b.crew_id ORDER BY created_at DESC LIMIT 20) z) eng_avg,
      (SELECT count(*) FILTER (WHERE status='completed') FROM crew_training_assignments t WHERE t.crew_id = b.crew_id) mods_done,
      (SELECT count(*) FROM crew_training_assignments t WHERE t.crew_id = b.crew_id) mods_total
    FROM public._manager_crew_base(v_uid) b, LATERAL public._cert_min_days(b.certs) c
  ), f AS (
    SELECT * FROM b WHERE
      (coalesce(p_search,'') = '' OR concat_ws(' ', name, rank, vessel, nationality, crew_unique_id, email) ILIKE '%'||p_search||'%')
      AND (coalesce(p_vessel,'') = '' OR coalesce(nullif(vessel,''),'Unassigned') = p_vessel)
      AND CASE p_filter
        WHEN 'certs' THEN exp30 > 0 OR expired > 0
        WHEN 'training' THEN mods_total > mods_done OR (crew_id IS NULL) OR (mods_total = 0 AND eng_last IS NULL)
        WHEN 'pending' THEN status IN ('pending','invited')
        WHEN 'onboard' THEN status = 'onboard' OR coalesce(vessel,'') <> ''
        ELSE true END)
  SELECT jsonb_build_object('ok', true,
    'total', (SELECT count(*) FROM f),
    'counts', jsonb_build_object('all', (SELECT count(*) FROM b), 'certs', (SELECT count(*) FROM b WHERE exp30>0 OR expired>0),
       'training', (SELECT count(*) FROM b WHERE mods_total > mods_done OR crew_id IS NULL OR (mods_total=0 AND eng_last IS NULL)),
       'pending', (SELECT count(*) FROM b WHERE status IN ('pending','invited')),
       'onboard', (SELECT count(*) FROM b WHERE status='onboard' OR coalesce(vessel,'')<>'')),
    'vessels', coalesce((SELECT jsonb_agg(jsonb_build_object('vessel', v, 'n', n) ORDER BY n DESC, v) FROM
       (SELECT coalesce(nullif(vessel,''),'Unassigned') v, count(*) n FROM f GROUP BY 1) vv), '[]'::jsonb),
    'rows', coalesce((SELECT jsonb_agg(jsonb_build_object('key', k, 'record_id', record_id, 'crew_id', crew_id, 'name', name, 'rank', rank,
       'nationality', nationality, 'vessel', vessel, 'status', status, 'sources', sources, 'crew_unique_id', crew_unique_id,
       'certs_total', ct, 'certs_30', exp30, 'certs_90', exp90, 'certs_expired', expired, 'sea_count', jsonb_array_length(sea),
       'eng_avg', eng_avg, 'eng_last', eng_last, 'mods_done', mods_done, 'mods_total', mods_total) ORDER BY
         (expired + exp30) DESC, eng_last DESC NULLS LAST, name)
       FROM (SELECT * FROM f ORDER BY (expired + exp30) DESC, eng_last DESC NULLS LAST, name OFFSET p_offset LIMIT p_limit) pg), '[]'::jsonb))
  INTO v_res;
  RETURN v_res;
END $$;
REVOKE ALL ON FUNCTION public.manager_unified_crew(text,text,text,int,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manager_unified_crew(text,text,text,int,int) TO authenticated;

CREATE OR REPLACE FUNCTION public.manager_unified_crew_detail(p_key text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); r record; v_approved boolean; v_rec company_crew_records;
BEGIN
  SELECT * INTO r FROM public._manager_crew_base(v_uid) b WHERE b.k = p_key;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_LINKED'); END IF;
  SELECT admin_approved INTO v_approved FROM manager_profiles WHERE user_id = v_uid;
  IF r.record_id IS NOT NULL THEN SELECT * INTO v_rec FROM company_crew_records WHERE id = r.record_id; END IF;
  INSERT INTO cv_access_log(manager_id, crew_id, action) SELECT v_uid, r.crew_id, 'unified_dossier' WHERE r.crew_id IS NOT NULL AND coalesce(v_approved,false)
    ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('ok', true, 'approved', coalesce(v_approved,false),
    'key', r.k, 'record_id', r.record_id, 'crew_id', r.crew_id, 'name', r.name, 'rank', r.rank, 'nationality', r.nationality,
    'vessel', r.vessel, 'status', r.status, 'sources', r.sources, 'crew_unique_id', r.crew_unique_id,
    'email', CASE WHEN v_approved OR r.record_id IS NOT NULL THEN r.email END,
    'whatsapp', CASE WHEN v_approved OR r.record_id IS NOT NULL THEN r.whatsapp END,
    'cdc_no', v_rec.cdc_no, 'passport_no', v_rec.passport_no, 'date_of_birth', v_rec.date_of_birth,
    'certificates', CASE WHEN v_approved OR r.crew_id IS NULL THEN r.certs ELSE '[]'::jsonb END,
    'sea_service', CASE WHEN v_approved OR r.crew_id IS NULL THEN r.sea ELSE '[]'::jsonb END,
    'contracts', coalesce((SELECT jsonb_agg(jsonb_build_object('vessel', sc.vessel_name, 'status', sc.status, 'start', sc.start_date,
        'months', sc.duration_months, 'currency', sc.currency, 'wage', sc.basic_wage) ORDER BY sc.created_at DESC)
       FROM sea_contracts sc JOIN job_applications ja ON ja.id = sc.application_id
       WHERE ja.crew_id = r.crew_id AND public._crew_desk_app_owned(ja.id)), '[]'::jsonb),
    'english', coalesce((SELECT jsonb_agg(jsonb_build_object('scenario', scenario_id, 'score', score, 'at', created_at) ORDER BY created_at DESC)
       FROM (SELECT * FROM english_attempts WHERE user_id = r.crew_id ORDER BY created_at DESC LIMIT 60) e), '[]'::jsonb),
    'modules', coalesce((SELECT jsonb_agg(jsonb_build_object('title', m.title, 'status', a.status, 'quiz_correct', a.quiz_correct,
       'quiz_total', a.quiz_total, 'completed_at', a.completed_at) ORDER BY coalesce(a.completed_at, a.created_at) DESC)
       FROM crew_training_assignments a JOIN training_modules m ON m.id = a.module_id WHERE a.crew_id = r.crew_id), '[]'::jsonb),
    'interviews', coalesce((SELECT jsonb_agg(jsonb_build_object('status', s.status, 'rank', s.rank, 'started_at', s.started_at,
       'completed_at', s.completed_at, 'shared', s.share_with_managers,
       'technical_pct', CASE WHEN s.share_with_managers THEN s.technical_pct END,
       'verdict', CASE WHEN s.share_with_managers THEN s.verdict END) ORDER BY s.started_at DESC)
       FROM maritime_interview_sessions s WHERE s.crew_id = r.crew_id), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.manager_unified_crew_detail(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manager_unified_crew_detail(text) TO authenticated;
NOTIFY pgrst, 'reload schema';