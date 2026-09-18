
-- ============ TABLES ============
CREATE TABLE public.takeover_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  template_id text NOT NULL DEFAULT 'bulk-carrier-pre-management-v1',
  template_version integer NOT NULL DEFAULT 1,
  vessel_name text NOT NULL,
  imo text,
  flag text,
  class_society text,
  port_of_registry text,
  inspector_name text,
  started_on date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted')),
  limitation_note text,
  submitted_by uuid,
  submitted_at timestamptz,
  submitted_snapshot jsonb,
  record_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.takeover_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES public.takeover_inspections(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('inspector','reviewer')),
  added_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (inspection_id, user_id)
);

CREATE TABLE public.takeover_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES public.takeover_inspections(id) ON DELETE RESTRICT,
  group_key text NOT NULL CHECK (group_key IN ('master','spares','safety','certificates')),
  item_ref text NOT NULL,
  template_version integer NOT NULL DEFAULT 1,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  author_id uuid NOT NULL DEFAULT auth.uid(),
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (inspection_id, group_key, item_ref)
);

CREATE TABLE public.takeover_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES public.takeover_inspections(id) ON DELETE RESTRICT,
  group_key text,
  item_ref text,
  photo_no integer,
  storage_path text NOT NULL,
  caption text,
  source_type text NOT NULL DEFAULT 'gallery' CHECK (source_type IN ('camera','gallery','document')),
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.takeover_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL,
  actor_id uuid,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_takeover_answers_inspection ON public.takeover_answers(inspection_id);
CREATE INDEX idx_takeover_attachments_inspection ON public.takeover_attachments(inspection_id);
CREATE INDEX idx_takeover_audit_inspection ON public.takeover_audit(inspection_id, created_at DESC);
CREATE INDEX idx_takeover_members_user ON public.takeover_members(user_id);

-- ============ GRANTS ============
GRANT SELECT, INSERT, UPDATE ON public.takeover_inspections TO authenticated;
GRANT ALL ON public.takeover_inspections TO service_role;
GRANT SELECT ON public.takeover_members TO authenticated;
GRANT ALL ON public.takeover_members TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.takeover_answers TO authenticated;
GRANT ALL ON public.takeover_answers TO service_role;
GRANT SELECT, INSERT ON public.takeover_attachments TO authenticated;
GRANT ALL ON public.takeover_attachments TO service_role;
GRANT SELECT ON public.takeover_audit TO authenticated;
GRANT ALL ON public.takeover_audit TO service_role;

-- ============ HELPERS (definer, no recursive policy loops) ============
CREATE OR REPLACE FUNCTION public.takeover_can_read(_inspection_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.takeover_inspections i
    WHERE i.id = _inspection_id
      AND (i.owner_id = auth.uid()
           OR public.is_admin(auth.uid())
           OR EXISTS (SELECT 1 FROM public.takeover_members m
                      WHERE m.inspection_id = i.id AND m.user_id = auth.uid()))
  )
$$;

CREATE OR REPLACE FUNCTION public.takeover_can_edit(_inspection_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.takeover_inspections i
    WHERE i.id = _inspection_id
      AND i.status = 'draft'
      AND (i.owner_id = auth.uid()
           OR EXISTS (SELECT 1 FROM public.takeover_members m
                      WHERE m.inspection_id = i.id AND m.user_id = auth.uid() AND m.role = 'inspector'))
  )
$$;

-- ============ RLS ============
ALTER TABLE public.takeover_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.takeover_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.takeover_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.takeover_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.takeover_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "takeover read own or member" ON public.takeover_inspections
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_admin(auth.uid())
         OR EXISTS (SELECT 1 FROM public.takeover_members m WHERE m.inspection_id = id AND m.user_id = auth.uid()));

CREATE POLICY "takeover insert admin only" ON public.takeover_inspections
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) AND owner_id = auth.uid());

CREATE POLICY "takeover update draft by editors" ON public.takeover_inspections
  FOR UPDATE TO authenticated
  USING (status = 'draft' AND (owner_id = auth.uid()
         OR EXISTS (SELECT 1 FROM public.takeover_members m WHERE m.inspection_id = id AND m.user_id = auth.uid() AND m.role = 'inspector')))
  WITH CHECK (status = 'draft');

CREATE POLICY "takeover members read scoped" ON public.takeover_members
  FOR SELECT TO authenticated
  USING (public.takeover_can_read(inspection_id));

CREATE POLICY "takeover answers read scoped" ON public.takeover_answers
  FOR SELECT TO authenticated USING (public.takeover_can_read(inspection_id));
CREATE POLICY "takeover answers insert scoped" ON public.takeover_answers
  FOR INSERT TO authenticated WITH CHECK (public.takeover_can_edit(inspection_id) AND author_id = auth.uid());
CREATE POLICY "takeover answers update scoped" ON public.takeover_answers
  FOR UPDATE TO authenticated USING (public.takeover_can_edit(inspection_id)) WITH CHECK (public.takeover_can_edit(inspection_id));

CREATE POLICY "takeover attachments read scoped" ON public.takeover_attachments
  FOR SELECT TO authenticated USING (public.takeover_can_read(inspection_id));
CREATE POLICY "takeover attachments insert scoped" ON public.takeover_attachments
  FOR INSERT TO authenticated WITH CHECK (public.takeover_can_edit(inspection_id) AND uploaded_by = auth.uid());

CREATE POLICY "takeover audit read scoped" ON public.takeover_audit
  FOR SELECT TO authenticated USING (public.takeover_can_read(inspection_id));

-- ============ IMMUTABILITY / AUDIT TRIGGERS ============
CREATE OR REPLACE FUNCTION public.takeover_guard_inspection()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.owner_id := OLD.owner_id;
  NEW.created_at := OLD.created_at;
  NEW.template_id := OLD.template_id;
  NEW.template_version := OLD.template_version;
  IF OLD.status = 'submitted' THEN
    RAISE EXCEPTION 'Inspection is submitted and locked';
  END IF;
  -- status/submission fields may only be set by the submit function (definer)
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.submitted_by IS DISTINCT FROM OLD.submitted_by
     OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
     OR NEW.submitted_snapshot IS DISTINCT FROM OLD.submitted_snapshot THEN
    RAISE EXCEPTION 'Submission fields are set by the submit function only';
  END IF;
  NEW.updated_at := now();
  NEW.record_version := OLD.record_version + 1;
  INSERT INTO public.takeover_audit(inspection_id, actor_id, action, entity, entity_id, detail)
  VALUES (OLD.id, auth.uid(), 'update', 'inspection', OLD.id,
          jsonb_build_object('record_version', NEW.record_version));
  RETURN NEW;
END $$;

CREATE TRIGGER trg_takeover_guard_inspection
  BEFORE UPDATE ON public.takeover_inspections
  FOR EACH ROW EXECUTE FUNCTION public.takeover_guard_inspection();

CREATE OR REPLACE FUNCTION public.takeover_answer_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.author_id := OLD.author_id;
    NEW.created_at := OLD.created_at;
    NEW.inspection_id := OLD.inspection_id;
    NEW.group_key := OLD.group_key;
    NEW.item_ref := OLD.item_ref;
    NEW.updated_at := now();
    NEW.updated_by := auth.uid();
  END IF;
  INSERT INTO public.takeover_audit(inspection_id, actor_id, action, entity, entity_id, detail)
  VALUES (NEW.inspection_id, auth.uid(), lower(TG_OP), 'answer', NEW.id,
          jsonb_build_object('group_key', NEW.group_key, 'item_ref', NEW.item_ref, 'version', NEW.version));
  RETURN NEW;
END $$;

CREATE TRIGGER trg_takeover_answer_audit
  BEFORE INSERT OR UPDATE ON public.takeover_answers
  FOR EACH ROW EXECUTE FUNCTION public.takeover_answer_audit();

CREATE OR REPLACE FUNCTION public.takeover_attachment_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.photo_no IS NULL THEN
    SELECT COALESCE(MAX(photo_no), 0) + 1 INTO NEW.photo_no
    FROM public.takeover_attachments WHERE inspection_id = NEW.inspection_id;
  END IF;
  INSERT INTO public.takeover_audit(inspection_id, actor_id, action, entity, entity_id, detail)
  VALUES (NEW.inspection_id, auth.uid(), 'insert', 'attachment', NEW.id,
          jsonb_build_object('path', NEW.storage_path, 'item_ref', NEW.item_ref));
  RETURN NEW;
END $$;

CREATE TRIGGER trg_takeover_attachment_audit
  BEFORE INSERT ON public.takeover_attachments
  FOR EACH ROW EXECUTE FUNCTION public.takeover_attachment_audit();

-- ============ RPCs ============
CREATE OR REPLACE FUNCTION public.takeover_create_inspection(
  p_vessel_name text, p_imo text DEFAULT NULL, p_flag text DEFAULT NULL,
  p_class_society text DEFAULT NULL, p_port_of_registry text DEFAULT NULL,
  p_inspector_name text DEFAULT NULL, p_started_on date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RETURN jsonb_build_object('error', 'Not authorised to create inspections');
  END IF;
  IF COALESCE(trim(p_vessel_name), '') = '' THEN
    RETURN jsonb_build_object('error', 'Vessel name is required');
  END IF;
  IF p_imo IS NOT NULL AND trim(p_imo) <> '' AND trim(p_imo) !~ '^[0-9]{7}$' THEN
    RETURN jsonb_build_object('error', 'IMO number must be 7 digits');
  END IF;
  INSERT INTO public.takeover_inspections(owner_id, vessel_name, imo, flag, class_society,
      port_of_registry, inspector_name, started_on)
  VALUES (auth.uid(), trim(p_vessel_name), NULLIF(trim(COALESCE(p_imo,'')),''), NULLIF(trim(COALESCE(p_flag,'')),''),
      NULLIF(trim(COALESCE(p_class_society,'')),''), NULLIF(trim(COALESCE(p_port_of_registry,'')),''),
      NULLIF(trim(COALESCE(p_inspector_name,'')),''), COALESCE(p_started_on, (now() AT TIME ZONE 'utc')::date))
  RETURNING id INTO v_id;
  INSERT INTO public.takeover_audit(inspection_id, actor_id, action, entity, entity_id, detail)
  VALUES (v_id, auth.uid(), 'create', 'inspection', v_id, jsonb_build_object('vessel_name', p_vessel_name));
  RETURN jsonb_build_object('id', v_id);
END $$;

CREATE OR REPLACE FUNCTION public.takeover_add_member(p_inspection_id uuid, p_email text, p_role text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid; v_owner uuid;
BEGIN
  SELECT owner_id INTO v_owner FROM public.takeover_inspections WHERE id = p_inspection_id;
  IF v_owner IS NULL THEN RETURN jsonb_build_object('error','Inspection not found'); END IF;
  IF auth.uid() IS DISTINCT FROM v_owner THEN
    RETURN jsonb_build_object('error','Only the inspection owner can grant access');
  END IF;
  IF p_role NOT IN ('inspector','reviewer') THEN
    RETURN jsonb_build_object('error','Role must be inspector or reviewer');
  END IF;
  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = lower(trim(p_email)) LIMIT 1;
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error','No registered account with that email'); END IF;
  IF v_uid = v_owner THEN RETURN jsonb_build_object('error','Owner already has full access'); END IF;
  INSERT INTO public.takeover_members(inspection_id, user_id, role, added_by)
  VALUES (p_inspection_id, v_uid, p_role, auth.uid())
  ON CONFLICT (inspection_id, user_id) DO UPDATE SET role = EXCLUDED.role;
  INSERT INTO public.takeover_audit(inspection_id, actor_id, action, entity, entity_id, detail)
  VALUES (p_inspection_id, auth.uid(), 'grant', 'member', v_uid, jsonb_build_object('role', p_role));
  RETURN jsonb_build_object('ok', true, 'user_id', v_uid, 'role', p_role);
END $$;

CREATE OR REPLACE FUNCTION public.takeover_remove_member(p_inspection_id uuid, p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner uuid;
BEGIN
  SELECT owner_id INTO v_owner FROM public.takeover_inspections WHERE id = p_inspection_id;
  IF auth.uid() IS DISTINCT FROM v_owner THEN
    RETURN jsonb_build_object('error','Only the inspection owner can change access');
  END IF;
  DELETE FROM public.takeover_members WHERE inspection_id = p_inspection_id AND user_id = p_user_id;
  INSERT INTO public.takeover_audit(inspection_id, actor_id, action, entity, entity_id, detail)
  VALUES (p_inspection_id, auth.uid(), 'revoke', 'member', p_user_id, '{}'::jsonb);
  RETURN jsonb_build_object('ok', true);
END $$;

-- member list with emails, owner-scoped (never exposes the wider user list)
CREATE OR REPLACE FUNCTION public.takeover_list_members(p_inspection_id uuid)
RETURNS TABLE(user_id uuid, email text, role text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.takeover_can_read(p_inspection_id) THEN RETURN; END IF;
  RETURN QUERY
    SELECT m.user_id, u.email::text, m.role, m.created_at
    FROM public.takeover_members m JOIN auth.users u ON u.id = m.user_id
    WHERE m.inspection_id = p_inspection_id ORDER BY m.created_at;
END $$;

-- optimistic-concurrency answer save
CREATE OR REPLACE FUNCTION public.takeover_save_answer(
  p_inspection_id uuid, p_group_key text, p_item_ref text, p_data jsonb, p_expected_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cur public.takeover_answers%ROWTYPE;
BEGIN
  IF NOT public.takeover_can_edit(p_inspection_id) THEN
    RETURN jsonb_build_object('error','You cannot edit this inspection');
  END IF;
  SELECT * INTO v_cur FROM public.takeover_answers
   WHERE inspection_id = p_inspection_id AND group_key = p_group_key AND item_ref = p_item_ref;
  IF v_cur.id IS NULL THEN
    INSERT INTO public.takeover_answers(inspection_id, group_key, item_ref, data, version, author_id, updated_by)
    VALUES (p_inspection_id, p_group_key, p_item_ref, COALESCE(p_data,'{}'::jsonb), 1, auth.uid(), auth.uid())
    RETURNING * INTO v_cur;
    RETURN jsonb_build_object('ok', true, 'version', v_cur.version, 'updated_at', v_cur.updated_at);
  END IF;
  IF p_expected_version IS NOT NULL AND p_expected_version <> v_cur.version THEN
    RETURN jsonb_build_object('conflict', true, 'version', v_cur.version, 'data', v_cur.data,
                              'updated_at', v_cur.updated_at);
  END IF;
  UPDATE public.takeover_answers
     SET data = COALESCE(p_data,'{}'::jsonb), version = version + 1
   WHERE id = v_cur.id RETURNING * INTO v_cur;
  RETURN jsonb_build_object('ok', true, 'version', v_cur.version, 'updated_at', v_cur.updated_at);
END $$;

CREATE OR REPLACE FUNCTION public.takeover_submit(p_inspection_id uuid, p_limitation_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.takeover_inspections%ROWTYPE; v_snap jsonb;
BEGIN
  SELECT * INTO v_row FROM public.takeover_inspections WHERE id = p_inspection_id;
  IF v_row.id IS NULL THEN RETURN jsonb_build_object('error','Inspection not found'); END IF;
  IF NOT public.takeover_can_edit(p_inspection_id) THEN
    RETURN jsonb_build_object('error','You cannot submit this inspection');
  END IF;
  SELECT jsonb_build_object(
      'inspection', to_jsonb(v_row),
      'answers', COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.group_key, a.item_ref)
                           FROM public.takeover_answers a WHERE a.inspection_id = p_inspection_id), '[]'::jsonb),
      'attachments', COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.photo_no)
                           FROM public.takeover_attachments t WHERE t.inspection_id = p_inspection_id), '[]'::jsonb))
    INTO v_snap;
  UPDATE public.takeover_inspections
     SET status = 'submitted', submitted_by = auth.uid(), submitted_at = now(),
         submitted_snapshot = v_snap, limitation_note = COALESCE(NULLIF(trim(COALESCE(p_limitation_note,'')),''), limitation_note),
         record_version = record_version + 1, updated_at = now()
   WHERE id = p_inspection_id;
  INSERT INTO public.takeover_audit(inspection_id, actor_id, action, entity, entity_id, detail)
  VALUES (p_inspection_id, auth.uid(), 'submit', 'inspection', p_inspection_id,
          jsonb_build_object('limitation_note', p_limitation_note));
  RETURN jsonb_build_object('ok', true, 'submitted_at', now());
END $$;

-- the guard trigger blocks direct submission-field writes; allow the definer submit path
CREATE OR REPLACE FUNCTION public.takeover_guard_inspection()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.owner_id := OLD.owner_id;
  NEW.created_at := OLD.created_at;
  NEW.template_id := OLD.template_id;
  NEW.template_version := OLD.template_version;
  IF OLD.status = 'submitted' THEN
    RAISE EXCEPTION 'Inspection is submitted and locked';
  END IF;
  IF (NEW.status IS DISTINCT FROM OLD.status
      OR NEW.submitted_by IS DISTINCT FROM OLD.submitted_by
      OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at)
     AND current_setting('takeover.submitting', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'Submission fields are set by the submit function only';
  END IF;
  NEW.updated_at := now();
  IF NEW.record_version = OLD.record_version THEN
    NEW.record_version := OLD.record_version + 1;
  END IF;
  INSERT INTO public.takeover_audit(inspection_id, actor_id, action, entity, entity_id, detail)
  VALUES (OLD.id, auth.uid(), 'update', 'inspection', OLD.id,
          jsonb_build_object('record_version', NEW.record_version));
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.takeover_submit(p_inspection_id uuid, p_limitation_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.takeover_inspections%ROWTYPE; v_snap jsonb;
BEGIN
  SELECT * INTO v_row FROM public.takeover_inspections WHERE id = p_inspection_id;
  IF v_row.id IS NULL THEN RETURN jsonb_build_object('error','Inspection not found'); END IF;
  IF NOT public.takeover_can_edit(p_inspection_id) THEN
    RETURN jsonb_build_object('error','You cannot submit this inspection');
  END IF;
  SELECT jsonb_build_object(
      'inspection', to_jsonb(v_row),
      'answers', COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.group_key, a.item_ref)
                           FROM public.takeover_answers a WHERE a.inspection_id = p_inspection_id), '[]'::jsonb),
      'attachments', COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.photo_no)
                           FROM public.takeover_attachments t WHERE t.inspection_id = p_inspection_id), '[]'::jsonb))
    INTO v_snap;
  PERFORM set_config('takeover.submitting', 'on', true);
  UPDATE public.takeover_inspections
     SET status = 'submitted', submitted_by = auth.uid(), submitted_at = now(),
         submitted_snapshot = v_snap,
         limitation_note = COALESCE(NULLIF(trim(COALESCE(p_limitation_note,'')),''), limitation_note)
   WHERE id = p_inspection_id;
  PERFORM set_config('takeover.submitting', 'off', true);
  INSERT INTO public.takeover_audit(inspection_id, actor_id, action, entity, entity_id, detail)
  VALUES (p_inspection_id, auth.uid(), 'submit', 'inspection', p_inspection_id,
          jsonb_build_object('limitation_note', p_limitation_note));
  RETURN jsonb_build_object('ok', true);
END $$;

REVOKE ALL ON FUNCTION public.takeover_create_inspection(text,text,text,text,text,text,date) FROM public;
GRANT EXECUTE ON FUNCTION public.takeover_create_inspection(text,text,text,text,text,text,date) TO authenticated;
REVOKE ALL ON FUNCTION public.takeover_add_member(uuid,text,text) FROM public;
GRANT EXECUTE ON FUNCTION public.takeover_add_member(uuid,text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.takeover_remove_member(uuid,uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.takeover_remove_member(uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.takeover_list_members(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.takeover_list_members(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.takeover_save_answer(uuid,text,text,jsonb,integer) FROM public;
GRANT EXECUTE ON FUNCTION public.takeover_save_answer(uuid,text,text,jsonb,integer) TO authenticated;
REVOKE ALL ON FUNCTION public.takeover_submit(uuid,text) FROM public;
GRANT EXECUTE ON FUNCTION public.takeover_submit(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.takeover_can_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.takeover_can_edit(uuid) TO authenticated;
