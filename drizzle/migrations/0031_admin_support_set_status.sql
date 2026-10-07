CREATE OR REPLACE FUNCTION public.admin_support_set_status(p_entity text, p_id uuid, p_status text, p_resolved_by_version text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_entity text := upper(trim(coalesce(p_entity,'')));
  v_status text := upper(trim(coalesce(p_status,'')));
  v_ver text := nullif(trim(coalesce(p_resolved_by_version,'')),'');
  v_old text;
  v_ref text;
  v_tickets int := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF p_id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','INVALID_ID'); END IF;

  IF v_entity = 'INCIDENT' THEN
    IF v_status NOT IN ('DETECTED','DIAGNOSED','PROPOSED_FIX','RESOLVED') THEN
      RETURN jsonb_build_object('ok',false,'error','INVALID_STATUS');
    END IF;
    IF v_ver IS NOT NULL AND v_status <> 'RESOLVED' THEN
      RETURN jsonb_build_object('ok',false,'error','VERSION_ONLY_ON_RESOLVED');
    END IF;
    SELECT status, incident_ref INTO v_old, v_ref FROM public.support_incidents WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','NOT_FOUND'); END IF;
    UPDATE public.support_incidents
      SET status = v_status,
          resolved_by_version = CASE WHEN v_status = 'RESOLVED' THEN coalesce(left(v_ver,64), resolved_by_version) ELSE resolved_by_version END
      WHERE id = p_id;
    IF v_status = 'RESOLVED' THEN
      UPDATE public.support_tickets SET status = 'RESOLVED'
        WHERE incident_id = p_id AND status IN ('RECEIVED','LINKED_INCIDENT');
      GET DIAGNOSTICS v_tickets = ROW_COUNT;
    END IF;
  ELSIF v_entity = 'TICKET' THEN
    IF v_ver IS NOT NULL THEN RETURN jsonb_build_object('ok',false,'error','VERSION_ONLY_ON_RESOLVED'); END IF;
    IF v_status NOT IN ('RECEIVED','LINKED_INCIDENT','RESPONDED','RESOLVED','CLOSED') THEN
      RETURN jsonb_build_object('ok',false,'error','INVALID_STATUS');
    END IF;
    SELECT status, ticket_ref INTO v_old, v_ref FROM public.support_tickets WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','NOT_FOUND'); END IF;
    UPDATE public.support_tickets SET status = v_status WHERE id = p_id;
  ELSE
    RETURN jsonb_build_object('ok',false,'error','INVALID_ENTITY');
  END IF;

  INSERT INTO public.app_events (event_type, message, severity, user_id, metadata)
  VALUES ('support_status_changed', 'Support ' || lower(v_entity) || ' status changed', 'info', auth.uid()::text,
    jsonb_build_object('entity', v_entity, 'ref', v_ref, 'old_status', v_old, 'new_status', v_status));

  RETURN jsonb_build_object('ok',true,'entity',v_entity,'ref',v_ref,'old_status',v_old,'new_status',v_status,'tickets_resolved',v_tickets);
END $$;
REVOKE ALL ON FUNCTION public.admin_support_set_status(text,uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_support_set_status(text,uuid,text,text) TO authenticated, service_role;