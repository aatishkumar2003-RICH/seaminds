
CREATE TABLE IF NOT EXISTS public.manager_training_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL,
  crew_id uuid,
  recipient_name text,
  email text,
  phone text,
  rank text,
  channel text NOT NULL CHECK (channel IN ('email','whatsapp','zalo','copy')),
  items text[] NOT NULL DEFAULT '{}',
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.manager_training_sends TO authenticated;
GRANT ALL ON public.manager_training_sends TO service_role;
ALTER TABLE public.manager_training_sends ENABLE ROW LEVEL SECURITY;
CREATE POLICY managers_read_own_training_sends ON public.manager_training_sends FOR SELECT TO authenticated USING (manager_id = auth.uid());
CREATE INDEX IF NOT EXISTS mts_manager_idx ON public.manager_training_sends(manager_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.manager_log_training_send(p_name text, p_email text, p_phone text, p_rank text, p_channel text, p_items text[], p_message text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_email text := lower(nullif(trim(coalesce(p_email,'')),'')); v_ph text := nullif(regexp_replace(coalesce(p_phone,''),'\D','','g'),''); v_crew uuid;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM manager_profiles WHERE user_id = v_uid) THEN RETURN jsonb_build_object('ok',false,'error','NOT_MANAGER'); END IF;
  IF p_channel NOT IN ('email','whatsapp','zalo','copy') THEN RETURN jsonb_build_object('ok',false,'error','BAD_CHANNEL'); END IF;
  IF (SELECT count(*) FROM manager_training_sends WHERE manager_id = v_uid AND created_at > now() - interval '1 day') >= 1000 THEN RETURN jsonb_build_object('ok',false,'error','DAILY_LIMIT'); END IF;
  IF v_email IS NOT NULL THEN SELECT id INTO v_crew FROM crew_profiles WHERE lower(email) = v_email LIMIT 1; END IF;
  IF v_crew IS NULL AND v_ph IS NOT NULL AND length(v_ph) >= 7 THEN SELECT id INTO v_crew FROM crew_profiles WHERE regexp_replace(coalesce(whatsapp_number,''),'\D','','g') = v_ph LIMIT 1; END IF;
  INSERT INTO manager_training_sends(manager_id, crew_id, recipient_name, email, phone, rank, channel, items, message)
  VALUES (v_uid, v_crew, left(nullif(trim(p_name),''),120), v_email, v_ph, left(nullif(trim(p_rank),''),60), p_channel, coalesce(p_items[1:12],'{}'), left(p_message, 8000));
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public.manager_log_training_send(text,text,text,text,text,text[],text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manager_log_training_send(text,text,text,text,text,text[],text) TO authenticated;

CREATE OR REPLACE FUNCTION public.manager_training_sent(p_search text DEFAULT '', p_rank text DEFAULT '', p_offset int DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_res jsonb;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM manager_profiles WHERE user_id = v_uid) THEN RETURN jsonb_build_object('ok',false,'error','NOT_MANAGER'); END IF;
  WITH s AS (
    SELECT t.*, coalesce(t.crew_id::text, t.email, t.phone, t.id::text) g FROM manager_training_sends t WHERE t.manager_id = v_uid
  ), g AS (
    SELECT s.g, (array_agg(s.crew_id) FILTER (WHERE s.crew_id IS NOT NULL))[1] crew_id,
      (array_agg(s.recipient_name ORDER BY s.created_at DESC) FILTER (WHERE s.recipient_name IS NOT NULL))[1] nm,
      (array_agg(s.rank ORDER BY s.created_at DESC) FILTER (WHERE s.rank IS NOT NULL))[1] rk,
      (array_agg(s.email ORDER BY s.created_at DESC) FILTER (WHERE s.email IS NOT NULL))[1] email,
      (array_agg(s.phone ORDER BY s.created_at DESC) FILTER (WHERE s.phone IS NOT NULL))[1] phone,
      count(*) sends, max(s.created_at) last_sent, array_agg(DISTINCT s.channel) channels,
      jsonb_agg(jsonb_build_object('at', s.created_at, 'channel', s.channel, 'items', s.items, 'message', s.message) ORDER BY s.created_at DESC) history
    FROM s GROUP BY s.g
  ), r AS (
    SELECT g.*, coalesce(nullif(trim(coalesce(cp.first_name,'')||' '||coalesce(cp.last_name,'')),''), g.nm, g.email, g.phone, 'Crew') name,
      coalesce(cp.role, g.rk) rank,
      (SELECT count(*) FROM crew_training_assignments a WHERE a.crew_id = g.crew_id AND a.status='completed') done,
      (SELECT count(*) FROM crew_training_assignments a WHERE a.crew_id = g.crew_id) total,
      greatest((SELECT max(created_at) FROM english_attempts e WHERE e.user_id = g.crew_id),
               (SELECT max(coalesce(completed_at,last_attempt_at,opened_at)) FROM crew_training_assignments a WHERE a.crew_id = g.crew_id AND a.created_at >= g.last_sent - interval '30 days')) active
    FROM g LEFT JOIN crew_profiles cp ON cp.id = g.crew_id
  ), f AS (
    SELECT * FROM r WHERE (coalesce(p_search,'')='' OR concat_ws(' ', name, rank, email, phone) ILIKE '%'||p_search||'%')
      AND (coalesce(p_rank,'')='' OR rank ILIKE '%'||p_rank||'%')
  )
  SELECT jsonb_build_object('ok', true, 'total', (SELECT count(*) FROM f),
    'ranks', coalesce((SELECT jsonb_agg(x ORDER BY x) FROM (SELECT DISTINCT rank x FROM r WHERE rank IS NOT NULL) q), '[]'::jsonb),
    'rows', coalesce((SELECT jsonb_agg(jsonb_build_object('key', g, 'crew_id', crew_id, 'name', name, 'rank', rank, 'email', email, 'phone', phone,
       'sends', sends, 'last_sent', last_sent, 'channels', channels, 'history', history, 'modules_done', done, 'modules_total', total, 'last_active', active,
       'status', CASE WHEN crew_id IS NULL THEN 'not_joined' WHEN total > 0 AND done = total THEN 'completed' WHEN active IS NOT NULL THEN 'in_progress' ELSE 'joined' END) ORDER BY last_sent DESC)
       FROM (SELECT * FROM f ORDER BY last_sent DESC OFFSET greatest(coalesce(p_offset,0),0) LIMIT 25) p), '[]'::jsonb))
  INTO v_res;
  RETURN v_res;
END $$;
REVOKE ALL ON FUNCTION public.manager_training_sent(text,text,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manager_training_sent(text,text,int) TO authenticated;

DROP FUNCTION IF EXISTS public.manager_training_radar(text, int);
CREATE OR REPLACE FUNCTION public.manager_training_radar(p_search text DEFAULT '', p_offset int DEFAULT 0, p_rank text DEFAULT '', p_status text DEFAULT 'all')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_ok boolean; v_rows jsonb; v_total int; v_ranks jsonb;
BEGIN
  SELECT coalesce(admin_approved, false) INTO v_ok FROM manager_profiles WHERE user_id = v_uid;
  IF v_ok IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_MANAGER'); END IF;
  CREATE TEMP TABLE IF NOT EXISTS _radar ON COMMIT DROP AS SELECT 1 x WHERE false;
  WITH l AS (
    SELECT crew_id, min(created_at) linked_at FROM manager_training_links WHERE manager_id = v_uid GROUP BY crew_id
  ), b AS (
    SELECT l.crew_id, l.linked_at, p.first_name, p.last_name, coalesce(p.rank, p.role) rank, p.email, p.whatsapp_number, p.last_seen,
      (SELECT count(*) FROM english_attempts e WHERE e.user_id = l.crew_id) eng_n,
      (SELECT count(*) FROM english_attempts e WHERE e.user_id = l.crew_id AND e.created_at > now() - interval '24 hours') eng_24h,
      (SELECT round(avg(x.score)) FROM (SELECT score FROM english_attempts e WHERE e.user_id = l.crew_id ORDER BY created_at DESC LIMIT 10) x) eng_avg,
      (SELECT max(score) FROM english_attempts e WHERE e.user_id = l.crew_id) eng_best,
      (SELECT max(created_at) FROM english_attempts e WHERE e.user_id = l.crew_id) eng_last,
      (SELECT scenario_id FROM english_attempts e WHERE e.user_id = l.crew_id ORDER BY created_at DESC LIMIT 1) eng_scenario,
      (SELECT count(*) FROM crew_training_assignments a WHERE a.crew_id = l.crew_id AND a.status = 'completed') mod_done,
      (SELECT count(*) FROM crew_training_assignments a WHERE a.crew_id = l.crew_id) mod_total,
      (SELECT max(coalesce(completed_at, last_attempt_at, opened_at, created_at)) FROM crew_training_assignments a WHERE a.crew_id = l.crew_id) mod_last,
      (SELECT count(*) FROM maritime_interview_sessions m WHERE m.crew_id = l.crew_id) int_n,
      (SELECT max(updated_at) FROM maritime_interview_sessions m WHERE m.crew_id = l.crew_id) int_last
    FROM l JOIN crew_profiles p ON p.id = l.crew_id
  ), c AS (
    SELECT b.*, GREATEST(b.eng_last, b.mod_last, b.int_last, b.last_seen) la FROM b
  ), f AS (
    SELECT * FROM c WHERE
      (coalesce(p_search,'') = '' OR concat_ws(' ', first_name, last_name, rank, email) ILIKE '%'||p_search||'%')
      AND (coalesce(p_rank,'') = '' OR rank ILIKE '%'||p_rank||'%')
      AND CASE coalesce(p_status,'all')
        WHEN 'today' THEN la > now() - interval '24 hours'
        WHEN 'complete' THEN mod_total > 0 AND mod_done = mod_total
        WHEN 'idle' THEN la IS NULL OR la < now() - interval '7 days'
        ELSE true END
  )
  SELECT (SELECT count(*) FROM f),
    coalesce((SELECT jsonb_agg(x ORDER BY x) FROM (SELECT DISTINCT rank x FROM c WHERE rank IS NOT NULL) q), '[]'::jsonb),
    coalesce((SELECT jsonb_agg(jsonb_build_object(
      'crew_id', s.crew_id, 'name', trim(coalesce(s.first_name,'')||' '||coalesce(s.last_name,'')), 'rank', s.rank,
      'email', CASE WHEN v_ok THEN s.email END, 'whatsapp', CASE WHEN v_ok THEN s.whatsapp_number END,
      'linked_at', s.linked_at, 'eng_attempts', s.eng_n, 'eng_24h', s.eng_24h, 'eng_avg', s.eng_avg, 'eng_best', s.eng_best,
      'eng_last', s.eng_last, 'eng_scenario', s.eng_scenario, 'modules_done', s.mod_done, 'modules_total', s.mod_total,
      'interviews', s.int_n, 'last_active', s.la) ORDER BY s.la DESC NULLS LAST)
      FROM (SELECT * FROM f ORDER BY la DESC NULLS LAST OFFSET greatest(coalesce(p_offset,0),0) LIMIT 25) s), '[]'::jsonb)
  INTO v_total, v_ranks, v_rows;
  RETURN jsonb_build_object('ok', true, 'approved', v_ok, 'total', coalesce(v_total,0), 'ranks', v_ranks, 'rows', v_rows);
END $$;
REVOKE ALL ON FUNCTION public.manager_training_radar(text,int,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manager_training_radar(text,int,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.manager_interview_people(p_search text DEFAULT '', p_rank text DEFAULT '', p_status text DEFAULT 'all', p_offset int DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_res jsonb;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM manager_profiles WHERE user_id = v_uid) THEN RETURN jsonb_build_object('ok',false,'error','NOT_MANAGER'); END IF;
  WITH i AS (
    SELECT iv.*, c.title campaign, c.rank_required,
      coalesce(iv.crew_profile_id::text, lower(nullif(trim(iv.invited_email),'')), nullif(regexp_replace(coalesce(iv.invited_whatsapp,''),'\D','','g'),''), iv.id::text) g
    FROM interview_invites iv JOIN interview_campaigns c ON c.id = iv.campaign_id WHERE c.manager_id = v_uid
  ), g AS (
    SELECT g, (array_agg(crew_profile_id) FILTER (WHERE crew_profile_id IS NOT NULL))[1] crew_id,
      (array_agg(invited_name ORDER BY created_at DESC) FILTER (WHERE coalesce(invited_name,'')<>''))[1] nm,
      (array_agg(invited_email ORDER BY created_at DESC) FILTER (WHERE coalesce(invited_email,'')<>''))[1] email,
      (array_agg(invited_whatsapp ORDER BY created_at DESC) FILTER (WHERE coalesce(invited_whatsapp,'')<>''))[1] wa,
      (array_agg(rank_required ORDER BY created_at DESC) FILTER (WHERE rank_required IS NOT NULL))[1] crk,
      count(*) n, max(created_at) last_at, max(overall_score) best, bool_or(shortlisted) shortlisted,
      bool_or(status='completed') any_done, bool_or(status IN ('started','in_progress')) any_prog,
      jsonb_agg(jsonb_build_object('id', id, 'token', token, 'campaign_id', campaign_id, 'campaign', campaign, 'status', status,
        'score', overall_score, 'created_at', created_at, 'completed_at', completed_at) ORDER BY created_at DESC) invites
    FROM i GROUP BY g
  ), r AS (
    SELECT g.*, coalesce(nullif(trim(coalesce(cp.first_name,'')||' '||coalesce(cp.last_name,'')),''), g.nm, g.email, 'Candidate') name,
      coalesce(cp.role, g.crk) rank, cp.nationality,
      CASE WHEN g.any_done THEN 'completed' WHEN g.any_prog THEN 'in_progress' ELSE 'invited' END st
    FROM g LEFT JOIN crew_profiles cp ON cp.id = g.crew_id
  ), f AS (
    SELECT * FROM r WHERE (coalesce(p_search,'')='' OR concat_ws(' ', name, rank, email, wa, nationality) ILIKE '%'||p_search||'%')
      AND (coalesce(p_rank,'')='' OR rank ILIKE '%'||p_rank||'%')
      AND (coalesce(p_status,'all')='all' OR st = p_status OR (p_status='shortlisted' AND shortlisted))
  )
  SELECT jsonb_build_object('ok', true, 'total', (SELECT count(*) FROM f),
    'counts', jsonb_build_object('all',(SELECT count(*) FROM r),'completed',(SELECT count(*) FROM r WHERE st='completed'),'in_progress',(SELECT count(*) FROM r WHERE st='in_progress'),'invited',(SELECT count(*) FROM r WHERE st='invited'),'shortlisted',(SELECT count(*) FROM r WHERE shortlisted)),
    'ranks', coalesce((SELECT jsonb_agg(x ORDER BY x) FROM (SELECT DISTINCT rank x FROM r WHERE rank IS NOT NULL) q), '[]'::jsonb),
    'rows', coalesce((SELECT jsonb_agg(jsonb_build_object('key', g, 'crew_id', crew_id, 'name', name, 'rank', rank, 'nationality', nationality,
       'email', email, 'whatsapp', wa, 'invites_count', n, 'last_at', last_at, 'best_score', best, 'status', st, 'shortlisted', coalesce(shortlisted,false), 'invites', invites) ORDER BY last_at DESC)
       FROM (SELECT * FROM f ORDER BY last_at DESC OFFSET greatest(coalesce(p_offset,0),0) LIMIT 25) p), '[]'::jsonb))
  INTO v_res;
  RETURN v_res;
END $$;
REVOKE ALL ON FUNCTION public.manager_interview_people(text,text,text,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manager_interview_people(text,text,text,int) TO authenticated;

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
    UNION ALL
    SELECT coalesce(iv.crew_profile_id::text, 'e:'||coalesce(lower(nullif(trim(iv.invited_email),'')), regexp_replace(coalesce(iv.invited_whatsapp,''),'\D','','g'))),
      NULL, iv.crew_profile_id, coalesce(nullif(trim(coalesce(cp.first_name,'')||' '||coalesce(cp.last_name,'')),''), iv.invited_name), coalesce(cp.role, c.rank_required), cp.nationality, NULL,
      'invited', 'interview', coalesce(cp.email, lower(nullif(trim(iv.invited_email),''))), coalesce(cp.whatsapp_number, iv.invited_whatsapp), cp.crew_unique_id, NULL, NULL, iv.created_at, 3
    FROM interview_invites iv JOIN interview_campaigns c ON c.id = iv.campaign_id LEFT JOIN crew_profiles cp ON cp.id = iv.crew_profile_id
    WHERE c.manager_id = v_uid AND (iv.crew_profile_id IS NOT NULL OR coalesce(iv.invited_email,'')<>'' OR coalesce(iv.invited_whatsapp,'')<>'')
      AND NOT EXISTS (SELECT 1 FROM company_crew_records r2 WHERE r2.manager_id = v_uid AND r2.crew_id IS NULL AND lower(r2.email) = lower(iv.invited_email))
    UNION ALL
    SELECT coalesce(t.crew_id::text, 'e:'||coalesce(t.email, t.phone)), NULL, t.crew_id,
      coalesce(nullif(trim(coalesce(cp.first_name,'')||' '||coalesce(cp.last_name,'')),''), t.recipient_name), coalesce(cp.role, t.rank), cp.nationality, NULL,
      'invited', 'training_invite', coalesce(cp.email, t.email), coalesce(cp.whatsapp_number, t.phone), cp.crew_unique_id, NULL, NULL, t.created_at, 4
    FROM manager_training_sends t LEFT JOIN crew_profiles cp ON cp.id = t.crew_id
    WHERE t.manager_id = v_uid AND (t.crew_id IS NOT NULL OR t.email IS NOT NULL OR t.phone IS NOT NULL)
      AND NOT EXISTS (SELECT 1 FROM company_crew_records r2 WHERE r2.manager_id = v_uid AND r2.crew_id IS NULL AND lower(r2.email) = t.email)
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

DROP FUNCTION IF EXISTS public.manager_unified_crew(text, text, text, int, int);
CREATE OR REPLACE FUNCTION public.manager_unified_crew(p_search text DEFAULT '', p_filter text DEFAULT 'all', p_vessel text DEFAULT '', p_offset int DEFAULT 0, p_limit int DEFAULT 25, p_rank text DEFAULT '')
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
      AND (coalesce(p_rank,'') = '' OR rank ILIKE '%'||p_rank||'%')
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
    'ranks', coalesce((SELECT jsonb_agg(x ORDER BY x) FROM (SELECT DISTINCT rank x FROM b WHERE coalesce(rank,'')<>'') q), '[]'::jsonb),
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
REVOKE ALL ON FUNCTION public.manager_unified_crew(text,text,text,int,int,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manager_unified_crew(text,text,text,int,int,text) TO authenticated;
NOTIFY pgrst, 'reload schema';
