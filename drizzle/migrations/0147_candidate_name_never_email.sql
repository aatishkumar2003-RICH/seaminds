CREATE OR REPLACE FUNCTION public.name_from_campaign_title(p_title text, p_rank text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT CASE WHEN p_title LIKE '% - %'
    AND trim(split_part(p_title,' - ',1)) <> ''
    AND trim(split_part(p_title,' - ',1)) !~ '[0-9@]'
    AND lower(trim(split_part(p_title,' - ',1))) <> lower(coalesce(p_rank,''))
  THEN left(trim(split_part(p_title,' - ',1)), 80) END
$$;

CREATE OR REPLACE FUNCTION public.manager_interview_people(p_search text DEFAULT ''::text, p_rank text DEFAULT ''::text, p_status text DEFAULT 'all'::text, p_offset integer DEFAULT 0)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_res jsonb;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM manager_profiles WHERE user_id = v_uid) THEN RETURN jsonb_build_object('ok',false,'error','NOT_MANAGER'); END IF;
  WITH i AS (
    SELECT iv.*, c.title campaign, c.rank_required, c.target_date camp_target, c.vessel_type camp_vessel, coalesce(iv.crew_profile_id, cpx.id) rcrew,
      coalesce(nullif(trim(iv.invited_name),''), ccr.nm, public.name_from_campaign_title(c.title, c.rank_required)) nm0,
      coalesce(lower(nullif(trim(iv.invited_email),'')), lower(nullif(trim(cpx.email),'')), iv.crew_profile_id::text, nullif(regexp_replace(coalesce(iv.invited_whatsapp,''),'\D','','g'),''), iv.id::text) g
    FROM interview_invites iv JOIN interview_campaigns c ON c.id = iv.campaign_id
    LEFT JOIN LATERAL (SELECT x.id, x.email FROM crew_profiles x WHERE x.id = iv.crew_profile_id OR (coalesce(iv.invited_email,'')<>'' AND lower(x.email) = lower(trim(iv.invited_email))) ORDER BY (x.id = iv.crew_profile_id) DESC LIMIT 1) cpx ON true
    LEFT JOIN LATERAL (SELECT nullif(trim(coalesce(r.first_name,'')||' '||coalesce(r.last_name,'')),'') nm FROM company_crew_records r WHERE r.manager_id = v_uid AND coalesce(iv.invited_email,'')<>'' AND lower(r.email) = lower(trim(iv.invited_email)) LIMIT 1) ccr ON true
    WHERE c.manager_id = v_uid
  ), g AS (
    SELECT g, (array_agg(rcrew) FILTER (WHERE rcrew IS NOT NULL))[1] crew_id,
      (array_agg(nm0 ORDER BY created_at DESC) FILTER (WHERE coalesce(nm0,'')<>''))[1] nm,
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

CREATE OR REPLACE FUNCTION public.trg_invite_default_name() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF coalesce(trim(NEW.invited_name),'') = '' THEN
    SELECT public.name_from_campaign_title(c.title, c.rank_required) INTO NEW.invited_name FROM interview_campaigns c WHERE c.id = NEW.campaign_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_invite_default_name ON public.interview_invites;
CREATE TRIGGER trg_invite_default_name BEFORE INSERT ON public.interview_invites FOR EACH ROW EXECUTE FUNCTION public.trg_invite_default_name();

UPDATE public.interview_invites iv SET invited_name = public.name_from_campaign_title(c.title, c.rank_required)
FROM public.interview_campaigns c WHERE c.id = iv.campaign_id AND coalesce(trim(iv.invited_name),'') = '' AND iv.invited_email IS NOT NULL;