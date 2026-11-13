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
    SELECT 'c:'||p.id::text, p.first_name, p.last_name, coalesce(p.rank,p.role), CASE WHEN v_ok THEN p.email END, CASE WHEN v_ok THEN p.whatsapp_number END, NULL, 'radar', p.id, l.created_at
      FROM manager_training_links l JOIN crew_profiles p ON p.id = l.crew_id WHERE l.manager_id = v_uid
    UNION ALL
    SELECT 'i:'||i.id::text, CASE WHEN coalesce(i.invited_name,'')<>'' THEN split_part(i.invited_name,' ',1) ELSE px.first_name END,
      CASE WHEN coalesce(i.invited_name,'')<>'' THEN nullif(substr(i.invited_name, length(split_part(i.invited_name,' ',1))+2),'') ELSE px.last_name END,
      coalesce(nullif(px.rank,''), c.rank_required), i.invited_email, i.invited_whatsapp, NULL, 'interview', coalesce(i.crew_profile_id, px.id), i.created_at
      FROM interview_invites i JOIN interview_campaigns c ON c.id = i.campaign_id LEFT JOIN LATERAL (SELECT x.id, x.first_name, x.last_name, x.rank FROM crew_profiles x WHERE x.id = i.crew_profile_id OR (coalesce(i.invited_email,'')<>'' AND lower(x.email) = lower(trim(i.invited_email))) ORDER BY (x.id = i.crew_profile_id) DESC LIMIT 1) px ON true WHERE c.manager_id = v_uid
    UNION ALL
    SELECT 's:'||s.id::text, split_part(coalesce(s.recipient_name,''),' ',1), nullif(substr(coalesce(s.recipient_name,''), length(split_part(coalesce(s.recipient_name,''),' ',1))+2),''),
      s.rank, s.email, s.phone, NULL, 'training', s.crew_id, s.created_at
      FROM manager_training_sends s WHERE s.manager_id = v_uid
  ), k AS (
    SELECT u.*, coalesce(crew_id::text, nullif(lower(email),''), nullif(regexp_replace(coalesce(whatsapp,''),'\D','','g'),''), id) kk FROM u
  )
  SELECT DISTINCT ON (kk) jsonb_build_object('id', id, 'first_name', coalesce(first_name,''), 'last_name', coalesce(last_name,''), 'rank', coalesce(rank,''),
    'email', email, 'whatsapp', whatsapp, 'vessel', vessel, 'source', src)
  FROM k WHERE coalesce(first_name,'')||coalesce(last_name,'')||coalesce(email,'')||coalesce(whatsapp,'') <> ''
  ORDER BY kk, (src='company') DESC, created_at DESC;
END $function$;

CREATE OR REPLACE FUNCTION public.manager_interview_people(p_search text DEFAULT ''::text, p_rank text DEFAULT ''::text, p_status text DEFAULT 'all'::text, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_res jsonb;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM manager_profiles WHERE user_id = v_uid) THEN RETURN jsonb_build_object('ok',false,'error','NOT_MANAGER'); END IF;
  WITH i AS (
    SELECT iv.*, c.title campaign, c.rank_required, c.target_date camp_target, c.vessel_type camp_vessel, coalesce(iv.crew_profile_id, cpx.id) rcrew,
      coalesce(lower(nullif(trim(iv.invited_email),'')), lower(nullif(trim(cpx.email),'')), iv.crew_profile_id::text, nullif(regexp_replace(coalesce(iv.invited_whatsapp,''),'\D','','g'),''), iv.id::text) g
    FROM interview_invites iv JOIN interview_campaigns c ON c.id = iv.campaign_id LEFT JOIN LATERAL (SELECT x.id, x.email FROM crew_profiles x WHERE x.id = iv.crew_profile_id OR (coalesce(iv.invited_email,'')<>'' AND lower(x.email) = lower(trim(iv.invited_email))) ORDER BY (x.id = iv.crew_profile_id) DESC LIMIT 1) cpx ON true WHERE c.manager_id = v_uid
  ), g AS (
    SELECT g, (array_agg(rcrew) FILTER (WHERE rcrew IS NOT NULL))[1] crew_id,
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
      coalesce(nullif(cp.rank,''), g.crk, cp.role) rank, cp.nationality,
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
END $function$;
NOTIFY pgrst, 'reload schema';