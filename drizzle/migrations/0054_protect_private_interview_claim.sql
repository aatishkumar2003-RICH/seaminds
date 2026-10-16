CREATE OR REPLACE FUNCTION public.claim_interview(p_token text, p_assessment_id uuid DEFAULT NULL::uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); inv record; camp record; new_id uuid; owner_email text; confirmed timestamptz;
BEGIN
 IF uid IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not signed in'); END IF;
 SELECT * INTO inv FROM interview_invites WHERE token=p_token FOR UPDATE;
 IF inv.id IS NOT NULL THEN
  IF inv.crew_profile_id IS NOT NULL AND inv.crew_profile_id <> uid THEN RETURN jsonb_build_object('ok',false,'error','INVITE_NOT_YOURS'); END IF;
  IF inv.crew_profile_id IS NULL THEN
   SELECT email,email_confirmed_at INTO owner_email,confirmed FROM auth.users WHERE id=uid;
   IF confirmed IS NULL OR inv.invited_email IS NULL OR lower(trim(inv.invited_email)) <> lower(trim(coalesce(owner_email,''))) THEN RETURN jsonb_build_object('ok',false,'error','INVITE_NOT_YOURS'); END IF;
  END IF;
  new_id := inv.id;
  SELECT * INTO camp FROM interview_campaigns WHERE id=inv.campaign_id;
 ELSE
  SELECT * INTO camp FROM interview_campaigns WHERE open_link_token=p_token AND status='open';
  IF camp.id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','invalid link'); END IF;
  PERFORM pg_advisory_xact_lock(hashtext(uid::text || ':' || camp.id::text));
  SELECT id INTO new_id FROM interview_invites WHERE campaign_id=camp.id AND crew_profile_id=uid LIMIT 1;
  IF new_id IS NULL THEN
   INSERT INTO interview_invites(campaign_id,token,crew_profile_id,status) VALUES(camp.id,make_invite_token(),uid,'in_progress') RETURNING id INTO new_id;
  END IF;
 END IF;
 IF camp.id IS NULL OR camp.status <> 'open' OR (camp.closes_at IS NOT NULL AND camp.closes_at < now()) THEN RETURN jsonb_build_object('ok',false,'error','CAMPAIGN_CLOSED'); END IF;
 IF p_assessment_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM smc_assessments a WHERE a.id=p_assessment_id AND a.crew_profile_id=uid AND a.invite_id=new_id) THEN RETURN jsonb_build_object('ok',false,'error','BINDING_MISMATCH'); END IF;
 UPDATE interview_invites SET crew_profile_id=coalesce(crew_profile_id,uid), status=CASE WHEN status='completed' THEN status ELSE 'in_progress' END, assessment_id=coalesce(p_assessment_id,assessment_id) WHERE id=new_id;
 RETURN jsonb_build_object('ok',true,'invite_id',new_id,'campaign_id',camp.id);
END $$;
REVOKE ALL ON FUNCTION public.claim_interview(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.claim_interview(text,uuid) TO authenticated,service_role;
NOTIFY pgrst, 'reload schema';