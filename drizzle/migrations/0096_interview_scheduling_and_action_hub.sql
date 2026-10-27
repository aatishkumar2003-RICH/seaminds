ALTER TABLE public.interview_invites
  ADD COLUMN IF NOT EXISTS schedule_mode text NOT NULL DEFAULT 'flex',
  ADD COLUMN IF NOT EXISTS proposed_slots jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS proposed_by text,
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS window_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS schedule_note text,
  ADD COLUMN IF NOT EXISTS schedule_updated_at timestamptz;

ALTER TABLE public.interview_invites DROP CONSTRAINT IF EXISTS interview_invites_schedule_mode_chk;
ALTER TABLE public.interview_invites ADD CONSTRAINT interview_invites_schedule_mode_chk
  CHECK (schedule_mode IN ('flex','proposed','confirmed'));

-- Manager proposes 1-3 slots (mode 'proposed') or opens a flex window (empty slots, hours>0)
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
    INSERT INTO notifications(user_id, title, body, type)
    VALUES (v_inv.crew_profile_id, 'Interview timing from the company', 'Open your Action Hub to confirm a time.', 'interview')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN json_build_object('ok', true);
EXCEPTION WHEN undefined_column OR not_null_violation OR check_violation THEN
  RETURN json_build_object('ok', true);
END $$;

-- Either party accepts one of the other side's slots, or counter-proposes up to 3
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

  BEGIN
    INSERT INTO notifications(user_id, title, body, type)
    VALUES (CASE WHEN v_party='crew' THEN v_mgr ELSE v_inv.crew_profile_id END,
      CASE WHEN p_accept IS NOT NULL THEN 'Interview time confirmed' ELSE 'New interview times proposed' END,
      COALESCE(v_inv.invited_name, 'Candidate') || ' — open interviews to view.', 'interview');
  EXCEPTION WHEN OTHERS THEN NULL; END;
  RETURN json_build_object('ok', true, 'confirmed', p_accept IS NOT NULL);
END $$;

-- Everything the crew must act on, in one owner-scoped call
CREATE OR REPLACE FUNCTION public.get_my_action_hub()
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT json_build_object(
    'interviews', COALESCE((SELECT json_agg(x ORDER BY x.created_at DESC) FROM (
      SELECT i.id, i.token, i.status, i.created_at, i.schedule_mode, i.proposed_slots, i.proposed_by,
             i.scheduled_at, i.window_ends_at, i.schedule_note, c.company_name, c.rank_required AS rank, c.title
        FROM interview_invites i JOIN interview_campaigns c ON c.id = i.campaign_id
       WHERE i.crew_profile_id = auth.uid() AND i.status <> 'completed'
       LIMIT 10) x), '[]'::json),
    'training', COALESCE((SELECT json_agg(t ORDER BY t.created_at DESC) FROM (
      SELECT a.id, a.token, a.status, a.created_at, m.title
        FROM crew_training_assignments a JOIN training_modules m ON m.id = a.module_id
       WHERE a.crew_id = auth.uid() AND a.status <> 'completed'
       LIMIT 12) t), '[]'::json),
    'training_done', (SELECT count(*) FROM crew_training_assignments WHERE crew_id = auth.uid() AND status = 'completed'),
    'contracts', COALESCE((SELECT json_agg(s) FROM (
      SELECT id, vessel_name, rank, employer_name, start_date FROM sea_contracts
       WHERE crew_id = auth.uid() AND status = 'issued' LIMIT 5) s), '[]'::json),
    'documents', COALESCE((SELECT json_agg(d) FROM (
      SELECT id, company_name, rank_applied FROM job_applications
       WHERE crew_id = auth.uid() AND outcome IN ('offered','accepted')
         AND COALESCE((offer_details->>'documents_required')::boolean, false) LIMIT 5) d), '[]'::json),
    'tickets', (SELECT count(*) FROM lineup_tickets t JOIN job_applications j ON j.id = t.application_id
       WHERE j.crew_id = auth.uid() AND t.status NOT IN ('resolved','closed'))
  )
$$;

REVOKE ALL ON FUNCTION public.manager_schedule_interview(uuid, timestamptz[], int, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.respond_interview_schedule(uuid, timestamptz, timestamptz[], text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_action_hub() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manager_schedule_interview(uuid, timestamptz[], int, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_interview_schedule(uuid, timestamptz, timestamptz[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_action_hub() TO authenticated;
NOTIFY pgrst, 'reload schema';