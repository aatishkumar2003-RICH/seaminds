ALTER TABLE public.interview_campaigns ADD COLUMN IF NOT EXISTS target_date date;
ALTER TABLE public.manager_training_sends ADD COLUMN IF NOT EXISTS target_date date;

DROP FUNCTION IF EXISTS public.manager_log_training_send(text,text,text,text,text,text[],text);
CREATE OR REPLACE FUNCTION public.manager_log_training_send(p_name text, p_email text, p_phone text, p_rank text, p_channel text, p_items text[], p_message text, p_target date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_email text := lower(nullif(trim(coalesce(p_email,'')),'')); v_ph text := nullif(regexp_replace(coalesce(p_phone,''),'\D','','g'),''); v_crew uuid;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM manager_profiles WHERE user_id = v_uid) THEN RETURN jsonb_build_object('ok',false,'error','NOT_MANAGER'); END IF;
  IF p_channel NOT IN ('email','whatsapp','zalo','copy') THEN RETURN jsonb_build_object('ok',false,'error','BAD_CHANNEL'); END IF;
  IF (SELECT count(*) FROM manager_training_sends WHERE manager_id = v_uid AND created_at > now() - interval '1 day') >= 1000 THEN RETURN jsonb_build_object('ok',false,'error','DAILY_LIMIT'); END IF;
  IF v_email IS NOT NULL THEN SELECT id INTO v_crew FROM crew_profiles WHERE lower(email) = v_email LIMIT 1; END IF;
  IF v_crew IS NULL AND v_ph IS NOT NULL AND length(v_ph) >= 7 THEN SELECT id INTO v_crew FROM crew_profiles WHERE regexp_replace(coalesce(whatsapp_number,''),'\D','','g') = v_ph LIMIT 1; END IF;
  INSERT INTO manager_training_sends(manager_id, crew_id, recipient_name, email, phone, rank, channel, items, message, target_date)
  VALUES (v_uid, v_crew, left(nullif(trim(p_name),''),120), v_email, v_ph, left(nullif(trim(p_rank),''),60), p_channel, coalesce(p_items[1:12],'{}'), left(p_message, 8000), p_target);
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public.manager_log_training_send(text,text,text,text,text,text[],text,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manager_log_training_send(text,text,text,text,text,text[],text,date) TO authenticated;

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
      (array_agg(s.target_date ORDER BY s.created_at DESC))[1] target_date, count(*) sends, max(s.created_at) last_sent, array_agg(DISTINCT s.channel) channels,
      jsonb_agg(jsonb_build_object('at', s.created_at, 'channel', s.channel, 'items', s.items, 'message', s.message, 'target_date', s.target_date) ORDER BY s.created_at DESC) history
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
       'sends', sends, 'target_date', target_date, 'last_sent', last_sent, 'channels', channels, 'history', history, 'modules_done', done, 'modules_total', total, 'last_active', active,
       'status', CASE WHEN crew_id IS NULL THEN 'not_joined' WHEN total > 0 AND done = total THEN 'completed' WHEN active IS NOT NULL THEN 'in_progress' ELSE 'joined' END) ORDER BY last_sent DESC)
       FROM (SELECT * FROM f ORDER BY last_sent DESC OFFSET greatest(coalesce(p_offset,0),0) LIMIT 25) p), '[]'::jsonb))
  INTO v_res;
  RETURN v_res;
END $$;
REVOKE ALL ON FUNCTION public.manager_training_sent(text,text,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manager_training_sent(text,text,int) TO authenticated;

CREATE OR REPLACE FUNCTION public.manager_interview_people(p_search text DEFAULT '', p_rank text DEFAULT '', p_status text DEFAULT 'all', p_offset int DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_res jsonb;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM manager_profiles WHERE user_id = v_uid) THEN RETURN jsonb_build_object('ok',false,'error','NOT_MANAGER'); END IF;
  WITH i AS (
    SELECT iv.*, c.title campaign, c.rank_required, c.target_date camp_target, c.vessel_type camp_vessel,
      coalesce(lower(nullif(trim(iv.invited_email),'')), lower(nullif(trim(cpx.email),'')), iv.crew_profile_id::text, nullif(regexp_replace(coalesce(iv.invited_whatsapp,''),'\D','','g'),''), iv.id::text) g
    FROM interview_invites iv JOIN interview_campaigns c ON c.id = iv.campaign_id LEFT JOIN crew_profiles cpx ON cpx.id = iv.crew_profile_id WHERE c.manager_id = v_uid
  ), g AS (
    SELECT g, (array_agg(crew_profile_id) FILTER (WHERE crew_profile_id IS NOT NULL))[1] crew_id,
      (array_agg(invited_name ORDER BY created_at DESC) FILTER (WHERE coalesce(invited_name,'')<>''))[1] nm,
      (array_agg(invited_email ORDER BY created_at DESC) FILTER (WHERE coalesce(invited_email,'')<>''))[1] email,
      (array_agg(invited_whatsapp ORDER BY created_at DESC) FILTER (WHERE coalesce(invited_whatsapp,'')<>''))[1] wa,
      (array_agg(rank_required ORDER BY created_at DESC) FILTER (WHERE rank_required IS NOT NULL))[1] crk,
      count(*) n, max(created_at) last_at, max(overall_score) best, bool_or(shortlisted) shortlisted,
      bool_or(status='completed') any_done, bool_or(status IN ('started','in_progress')) any_prog,
      jsonb_agg(jsonb_build_object('id', id, 'token', token, 'campaign_id', campaign_id, 'campaign', campaign, 'status', status,
        'score', overall_score, 'created_at', created_at, 'completed_at', completed_at, 'target_date', camp_target, 'vessel_type', camp_vessel) ORDER BY created_at DESC) invites
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

DROP FUNCTION IF EXISTS public.manager_training_radar(text,int,text,text);
CREATE OR REPLACE FUNCTION public.manager_training_radar(p_search text DEFAULT '', p_offset int DEFAULT 0, p_rank text DEFAULT '', p_status text DEFAULT 'all', p_vessel text DEFAULT '', p_from date DEFAULT NULL, p_to date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_ok boolean; v_rows jsonb; v_total int; v_ranks jsonb; v_vessels jsonb;
BEGIN
  SELECT coalesce(admin_approved, false) INTO v_ok FROM manager_profiles WHERE user_id = v_uid;
  IF v_ok IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_MANAGER'); END IF;
  WITH l AS (
    SELECT crew_id, min(created_at) linked_at FROM manager_training_links WHERE manager_id = v_uid GROUP BY crew_id
  ), b AS (
    SELECT l.crew_id, l.linked_at, p.first_name, p.last_name, coalesce(p.rank, p.role) rank, p.email, p.whatsapp_number, p.last_seen,
      (SELECT nullif(trim(r.vessel),'') FROM company_crew_records r WHERE r.manager_id = v_uid AND (r.crew_id = l.crew_id OR (p.email IS NOT NULL AND lower(r.email) = lower(p.email))) AND coalesce(trim(r.vessel),'') <> '' ORDER BY r.updated_at DESC NULLS LAST LIMIT 1) vessel,
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
      (SELECT max(updated_at) FROM maritime_interview_sessions m WHERE m.crew_id = l.crew_id) int_last,
      (SELECT t.target_date FROM manager_training_sends t WHERE t.manager_id = v_uid AND t.crew_id = l.crew_id ORDER BY t.created_at DESC LIMIT 1) target_date
    FROM l JOIN crew_profiles p ON p.id = l.crew_id
  ), c AS (
    SELECT b.*, GREATEST(b.eng_last, b.mod_last, b.int_last, b.last_seen) la FROM b
  ), f AS (
    SELECT * FROM c WHERE
      (coalesce(p_search,'') = '' OR concat_ws(' ', first_name, last_name, rank, email, vessel) ILIKE '%'||p_search||'%')
      AND (coalesce(p_rank,'') = '' OR rank ILIKE '%'||p_rank||'%')
      AND (coalesce(p_vessel,'') = '' OR (p_vessel = '__none' AND vessel IS NULL) OR vessel = p_vessel)
      AND (p_from IS NULL OR la >= p_from::timestamptz)
      AND (p_to IS NULL OR la < (p_to + 1)::timestamptz)
      AND CASE coalesce(p_status,'all')
        WHEN 'today' THEN la > now() - interval '24 hours'
        WHEN 'complete' THEN mod_total > 0 AND mod_done = mod_total
        WHEN 'idle' THEN la IS NULL OR la < now() - interval '7 days'
        WHEN 'overdue' THEN target_date IS NOT NULL AND target_date < current_date AND NOT (mod_total > 0 AND mod_done = mod_total)
        ELSE true END
  )
  SELECT (SELECT count(*) FROM f),
    coalesce((SELECT jsonb_agg(x ORDER BY x) FROM (SELECT DISTINCT rank x FROM c WHERE rank IS NOT NULL) q), '[]'::jsonb),
    coalesce((SELECT jsonb_agg(x ORDER BY x) FROM (SELECT DISTINCT vessel x FROM c WHERE vessel IS NOT NULL) q), '[]'::jsonb),
    coalesce((SELECT jsonb_agg(jsonb_build_object(
      'crew_id', s.crew_id, 'name', trim(coalesce(s.first_name,'')||' '||coalesce(s.last_name,'')), 'rank', s.rank, 'vessel', s.vessel,
      'email', CASE WHEN v_ok THEN s.email END, 'whatsapp', CASE WHEN v_ok THEN s.whatsapp_number END,
      'linked_at', s.linked_at, 'eng_attempts', s.eng_n, 'eng_24h', s.eng_24h, 'eng_avg', s.eng_avg, 'eng_best', s.eng_best,
      'eng_last', s.eng_last, 'eng_scenario', s.eng_scenario, 'modules_done', s.mod_done, 'modules_total', s.mod_total,
      'interviews', s.int_n, 'last_active', s.la, 'target_date', s.target_date) ORDER BY s.la DESC NULLS LAST)
      FROM (SELECT * FROM f ORDER BY la DESC NULLS LAST OFFSET greatest(coalesce(p_offset,0),0) LIMIT 25) s), '[]'::jsonb)
  INTO v_total, v_ranks, v_vessels, v_rows;
  RETURN jsonb_build_object('ok', true, 'approved', v_ok, 'total', coalesce(v_total,0), 'ranks', v_ranks, 'vessels', v_vessels, 'rows', v_rows);
END $$;
REVOKE ALL ON FUNCTION public.manager_training_radar(text,int,text,text,text,date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manager_training_radar(text,int,text,text,text,date,date) TO authenticated;
NOTIFY pgrst, 'reload schema';