CREATE OR REPLACE FUNCTION public.manager_schedule_interview(p_invite_id uuid, p_slots timestamptz[], p_flex_hours int DEFAULT NULL, p_note text DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_inv interview_invites%ROWTYPE; v_slots timestamptz[];
BEGIN
  SELECT i.* INTO v_inv FROM interview_invites i JOIN interview_campaigns c ON c.id = i.campaign_id
   WHERE i.id = p_invite_id AND c.manager_id = auth.uid();
  IF NOT FOUND THEN RETURN json_build_object('ok', false, 'error', 'not_allowed'); END IF;
  IF v_inv.status = 'completed' THEN RETURN json_build_object('ok', false, 'error', 'already_completed'); END IF;
  IF p_flex_hours IS NOT NULL THEN
    IF p_flex_hours < 12 OR p_flex_hours > 168 THEN RETURN json_build_object('ok', false, 'error', 'bad_window'); END IF;
    UPDATE interview_invites SET schedule_mode='flex', proposed_slots='[]', proposed_by=NULL, scheduled_at=NULL,
      window_ends_at = now() + make_interval(hours => p_flex_hours), schedule_note=left(p_note,300), schedule_updated_at=now()
     WHERE id = p_invite_id;
  ELSE
    SELECT array_agg(s ORDER BY s) INTO v_slots FROM unnest(p_slots) s WHERE s > now() + interval '30 minutes';
    IF v_slots IS NULL OR array_length(v_slots,1) > 3 THEN RETURN json_build_object('ok', false, 'error', 'bad_slots'); END IF;
    UPDATE interview_invites SET schedule_mode='proposed', proposed_slots=to_jsonb(v_slots), proposed_by='manager',
      scheduled_at=NULL, window_ends_at=NULL, schedule_note=left(p_note,300), schedule_updated_at=now()
     WHERE id = p_invite_id;
  END IF;
  IF v_inv.crew_profile_id IS NOT NULL THEN
    BEGIN
      INSERT INTO notifications(crew_id, kind, title, body, icon, link)
      VALUES (v_inv.crew_profile_id, 'interview', 'Interview timing from the company', 'Open your Action Hub to confirm a time.', '🎤', '/my-responses');
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
  RETURN json_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.respond_interview_schedule(p_invite_id uuid, p_accept timestamptz DEFAULT NULL, p_counter timestamptz[] DEFAULT NULL, p_note text DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_inv interview_invites%ROWTYPE; v_party text; v_slots timestamptz[]; v_mgr uuid;
BEGIN
  SELECT i.* INTO v_inv FROM interview_invites i WHERE i.id = p_invite_id;
  IF NOT FOUND THEN RETURN json_build_object('ok', false, 'error', 'not_found'); END IF;
  SELECT manager_id INTO v_mgr FROM interview_campaigns WHERE id = v_inv.campaign_id;
  v_party := CASE WHEN v_inv.crew_profile_id = auth.uid() THEN 'crew' WHEN v_mgr = auth.uid() THEN 'manager' END;
  IF v_party IS NULL THEN RETURN json_build_object('ok', false, 'error', 'not_allowed'); END IF;
  IF v_inv.status = 'completed' THEN RETURN json_build_object('ok', false, 'error', 'already_completed'); END IF;

  IF p_accept IS NOT NULL THEN
    IF v_inv.schedule_mode <> 'proposed' OR v_inv.proposed_by = v_party
       OR NOT (v_inv.proposed_slots @> to_jsonb(ARRAY[p_accept])) OR p_accept < now() THEN
      RETURN json_build_object('ok', false, 'error', 'slot_unavailable');
    END IF;
    UPDATE interview_invites SET schedule_mode='confirmed', scheduled_at=p_accept,
      window_ends_at = p_accept + interval '2 hours', schedule_updated_at=now(),
      schedule_note = COALESCE(left(p_note,300), schedule_note)
     WHERE id = p_invite_id;
  ELSE
    SELECT array_agg(s ORDER BY s) INTO v_slots FROM unnest(p_counter) s WHERE s > now() + interval '30 minutes';
    IF v_slots IS NULL OR array_length(v_slots,1) > 3 THEN RETURN json_build_object('ok', false, 'error', 'bad_slots'); END IF;
    UPDATE interview_invites SET schedule_mode='proposed', proposed_slots=to_jsonb(v_slots), proposed_by=v_party,
      scheduled_at=NULL, window_ends_at=NULL, schedule_note=left(p_note,300), schedule_updated_at=now()
     WHERE id = p_invite_id;
  END IF;

  IF v_party = 'manager' AND v_inv.crew_profile_id IS NOT NULL THEN
    BEGIN
      INSERT INTO notifications(crew_id, kind, title, body, icon, link)
      VALUES (v_inv.crew_profile_id, 'interview',
        CASE WHEN p_accept IS NOT NULL THEN 'Interview time confirmed' ELSE 'New interview times proposed' END,
        'Open your Action Hub for details.', '🎤', '/my-responses');
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
  RETURN json_build_object('ok', true, 'confirmed', p_accept IS NOT NULL);
END $$;
NOTIFY pgrst, 'reload schema';