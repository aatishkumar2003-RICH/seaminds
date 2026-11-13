CREATE OR REPLACE FUNCTION public.manager_interview_people(p_search text DEFAULT '', p_rank text DEFAULT '', p_status text DEFAULT 'all', p_offset int DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_res jsonb;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM manager_profiles WHERE user_id = v_uid) THEN RETURN jsonb_build_object('ok',false,'error','NOT_MANAGER'); END IF;
  WITH i AS (
    SELECT iv.*, c.title campaign, c.rank_required,
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

CREATE OR REPLACE FUNCTION public.manager_delete_invite(p_invite_id uuid, p_force boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_st text;
BEGIN
  SELECT iv.status INTO v_st FROM interview_invites iv JOIN interview_campaigns c ON c.id=iv.campaign_id
   WHERE iv.id=p_invite_id AND c.manager_id=auth.uid();
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','NOT_FOUND'); END IF;
  IF v_st IN ('completed','started','in_progress') AND NOT p_force THEN RETURN jsonb_build_object('ok',false,'error','HAS_PROGRESS','status',v_st); END IF;
  DELETE FROM interview_invites WHERE id=p_invite_id;
  RETURN jsonb_build_object('ok',true);
END $$;
REVOKE ALL ON FUNCTION public.manager_delete_invite(uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manager_delete_invite(uuid,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.manager_delete_campaign(p_campaign_id uuid, p_force boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_n int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM interview_campaigns WHERE id=p_campaign_id AND manager_id=auth.uid()) THEN RETURN jsonb_build_object('ok',false,'error','NOT_FOUND'); END IF;
  SELECT count(*) INTO v_n FROM interview_invites WHERE campaign_id=p_campaign_id AND status IN ('completed','started','in_progress');
  IF v_n>0 AND NOT p_force THEN RETURN jsonb_build_object('ok',false,'error','HAS_PROGRESS','count',v_n); END IF;
  DELETE FROM interview_campaigns WHERE id=p_campaign_id;
  RETURN jsonb_build_object('ok',true);
END $$;
REVOKE ALL ON FUNCTION public.manager_delete_campaign(uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manager_delete_campaign(uuid,boolean) TO authenticated;