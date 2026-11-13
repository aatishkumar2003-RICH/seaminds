CREATE OR REPLACE FUNCTION public.manager_training_pool()
RETURNS SETOF jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
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
    SELECT 'i:'||i.id::text, split_part(coalesce(i.invited_name,''),' ',1), nullif(substr(coalesce(i.invited_name,''), length(split_part(coalesce(i.invited_name,''),' ',1))+2),''),
      c.rank_required, i.invited_email, i.invited_whatsapp, NULL, 'interview', i.crew_profile_id, i.created_at
      FROM interview_invites i JOIN interview_campaigns c ON c.id = i.campaign_id WHERE c.manager_id = v_uid
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
END $$;