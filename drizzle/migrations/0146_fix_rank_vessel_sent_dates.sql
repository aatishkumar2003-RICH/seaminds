CREATE OR REPLACE FUNCTION public.manager_training_sent(p_search text DEFAULT ''::text, p_rank text DEFAULT ''::text, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      (array_agg(s.target_date ORDER BY s.created_at DESC))[1] target_date, count(*) sends, max(s.created_at) last_sent, min(s.created_at) first_sent, array_agg(DISTINCT s.channel) channels,
      jsonb_agg(jsonb_build_object('at', s.created_at, 'channel', s.channel, 'items', s.items, 'message', s.message, 'target_date', s.target_date) ORDER BY s.created_at DESC) history
    FROM s GROUP BY s.g
  ), r AS (
    SELECT g.*, coalesce(nullif(trim(coalesce(cp.first_name,'')||' '||coalesce(cp.last_name,'')),''), g.nm, g.email, g.phone, 'Crew') name,
      coalesce(nullif(cp.rank,''), nullif(g.rk,''), nullif(cp.role,'')) rank,
      (SELECT nullif(r2.vessel,'') FROM company_crew_records r2 WHERE r2.manager_id = v_uid AND nullif(r2.vessel,'') IS NOT NULL AND ((g.crew_id IS NOT NULL AND r2.crew_id = g.crew_id) OR (g.email IS NOT NULL AND lower(r2.email) = g.email)) LIMIT 1) vessel,
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
       'sends', sends, 'target_date', target_date, 'last_sent', last_sent, 'first_sent', first_sent, 'vessel', vessel, 'channels', channels, 'history', history, 'modules_done', done, 'modules_total', total, 'last_active', active,
       'status', CASE WHEN crew_id IS NULL THEN 'not_joined' WHEN total > 0 AND done = total THEN 'completed' WHEN active IS NOT NULL THEN 'in_progress' ELSE 'joined' END) ORDER BY last_sent DESC)
       FROM (SELECT * FROM f ORDER BY last_sent DESC OFFSET greatest(coalesce(p_offset,0),0) LIMIT 25) p), '[]'::jsonb))
  INTO v_res;
  RETURN v_res;
END $function$;

CREATE OR REPLACE FUNCTION public.manager_training_pool()
 RETURNS SETOF jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_ok boolean;
BEGIN
  SELECT coalesce(admin_approved,false) INTO v_ok FROM manager_profiles WHERE user_id = v_uid;
  IF v_ok IS NULL THEN RETURN; END IF;
  RETURN QUERY
  WITH u AS (
    SELECT 'r:'||r.id::text id, r.first_name, r.last_name, r.rank, r.email, r.whatsapp, r.vessel, 'company'::text src, r.crew_id, r.created_at
      FROM company_crew_records r WHERE r.manager_id = v_uid
    UNION ALL
    SELECT 'c:'||p.id::text, p.first_name, p.last_name, coalesce(nullif(p.rank,''),p.role), CASE WHEN v_ok THEN p.email END, CASE WHEN v_ok THEN p.whatsapp_number END, NULL, 'radar', p.id, l.created_at
      FROM manager_training_links l JOIN crew_profiles p ON p.id = l.crew_id WHERE l.manager_id = v_uid
    UNION ALL
    SELECT 'i:'||i.id::text, CASE WHEN coalesce(i.invited_name,'')<>'' THEN split_part(i.invited_name,' ',1) ELSE px.first_name END,
      CASE WHEN coalesce(i.invited_name,'')<>'' THEN nullif(substr(i.invited_name, length(split_part(i.invited_name,' ',1))+2),'') ELSE px.last_name END,
      coalesce(nullif(px.rank,''), c.rank_required), i.invited_email, i.invited_whatsapp, NULL, 'interview', coalesce(i.crew_profile_id, px.id), i.created_at
      FROM interview_invites i JOIN interview_campaigns c ON c.id = i.campaign_id LEFT JOIN LATERAL (SELECT x.id, x.first_name, x.last_name, x.rank FROM crew_profiles x WHERE x.id = i.crew_profile_id OR (coalesce(i.invited_email,'')<>'' AND lower(x.email) = lower(trim(i.invited_email))) ORDER BY (x.id = i.crew_profile_id) DESC LIMIT 1) px ON true WHERE c.manager_id = v_uid
    UNION ALL
    SELECT 's:'||s.id::text, split_part(coalesce(s.recipient_name,''),' ',1), nullif(substr(coalesce(s.recipient_name,''), length(split_part(coalesce(s.recipient_name,''),' ',1))+2),''),
      coalesce(nullif(s.rank,''), nullif(sp.rank,'')), s.email, s.phone, NULL, 'training', s.crew_id, s.created_at
      FROM manager_training_sends s LEFT JOIN crew_profiles sp ON sp.id = s.crew_id WHERE s.manager_id = v_uid
  ), k AS (
    SELECT u.*, coalesce(crew_id::text, nullif(lower(email),''), nullif(regexp_replace(coalesce(whatsapp,''),'\D','','g'),''), id) kk FROM u
  )
  SELECT DISTINCT ON (kk) jsonb_build_object('id', id, 'first_name', coalesce(first_name,''), 'last_name', coalesce(last_name,''), 'rank', coalesce(rank,''),
    'email', email, 'whatsapp', whatsapp, 'vessel', vessel, 'source', src)
  FROM k WHERE coalesce(first_name,'')||coalesce(last_name,'')||coalesce(email,'')||coalesce(whatsapp,'') <> ''
  ORDER BY kk, (src='company') DESC, (coalesce(rank,'')<>'') DESC, created_at DESC;
END $function$;

CREATE OR REPLACE FUNCTION public.manager_log_training_send(p_name text, p_email text, p_phone text, p_rank text, p_channel text, p_items text[], p_message text, p_target date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_email text := lower(nullif(trim(coalesce(p_email,'')),'')); v_ph text := nullif(regexp_replace(coalesce(p_phone,''),'\D','','g'),''); v_crew uuid;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM manager_profiles WHERE user_id = v_uid) THEN RETURN jsonb_build_object('ok',false,'error','NOT_MANAGER'); END IF;
  IF p_channel NOT IN ('email','whatsapp','zalo','copy') THEN RETURN jsonb_build_object('ok',false,'error','BAD_CHANNEL'); END IF;
  IF (SELECT count(*) FROM manager_training_sends WHERE manager_id = v_uid AND created_at > now() - interval '1 day') >= 1000 THEN RETURN jsonb_build_object('ok',false,'error','DAILY_LIMIT'); END IF;
  IF v_email IS NOT NULL THEN SELECT id INTO v_crew FROM crew_profiles WHERE lower(email) = v_email LIMIT 1; END IF;
  IF v_crew IS NULL AND v_ph IS NOT NULL AND length(v_ph) >= 7 THEN SELECT id INTO v_crew FROM crew_profiles WHERE regexp_replace(coalesce(whatsapp_number,''),'\D','','g') = v_ph LIMIT 1; END IF;
  IF v_crew IS NOT NULL THEN SELECT coalesce(nullif(trim(p_rank),''), nullif(rank,'')), coalesce(nullif(trim(p_name),''), nullif(trim(coalesce(first_name,'')||' '||coalesce(last_name,'')),'')) INTO p_rank, p_name FROM crew_profiles WHERE id = v_crew; END IF;
  INSERT INTO manager_training_sends(manager_id, crew_id, recipient_name, email, phone, rank, channel, items, message, target_date)
  VALUES (v_uid, v_crew, left(nullif(trim(p_name),''),120), v_email, v_ph, left(nullif(trim(p_rank),''),60), p_channel, coalesce(p_items[1:12],'{}'), left(p_message, 8000), p_target);
  RETURN jsonb_build_object('ok', true);
END $function$;

NOTIFY pgrst, 'reload schema';