-- 1. Server-held template requirements (authoritative completeness source)
CREATE TABLE IF NOT EXISTS public.takeover_template_requirements (
  template_id text NOT NULL,
  template_version integer NOT NULL,
  group_key text NOT NULL,
  item_ref text NOT NULL,
  photo_required boolean NOT NULL DEFAULT false,
  PRIMARY KEY (template_id, template_version, group_key, item_ref)
);
GRANT SELECT ON public.takeover_template_requirements TO authenticated;
GRANT ALL ON public.takeover_template_requirements TO service_role;
ALTER TABLE public.takeover_template_requirements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "takeover template requirements readable" ON public.takeover_template_requirements;
CREATE POLICY "takeover template requirements readable"
  ON public.takeover_template_requirements FOR SELECT TO authenticated USING (true);

INSERT INTO public.takeover_template_requirements(template_id, template_version, group_key, item_ref, photo_required)
SELECT 'bulk-carrier-pre-management-v1', 1, g.k, s::text,
       g.k = 'master' AND (s = 6 OR (s BETWEEN 18 AND 110) OR (s BETWEEN 115 AND 119))
FROM (VALUES ('master',119),('spares',72),('safety',31),('certificates',60)) AS g(k,n),
     LATERAL generate_series(1, g.n) AS s
ON CONFLICT DO NOTHING;

-- 2. Partial marker on the header
ALTER TABLE public.takeover_inspections ADD COLUMN IF NOT EXISTS is_partial boolean NOT NULL DEFAULT false;

-- 3. Uniqueness needed for atomic upsert
CREATE UNIQUE INDEX IF NOT EXISTS takeover_answers_item_uniq
  ON public.takeover_answers (inspection_id, group_key, item_ref);

-- 4. Audit keeps before/after values
CREATE OR REPLACE FUNCTION public.takeover_answer_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
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
          jsonb_build_object(
            'group_key', NEW.group_key, 'item_ref', NEW.item_ref,
            'version_before', CASE WHEN TG_OP = 'UPDATE' THEN OLD.version ELSE NULL END,
            'version_after', NEW.version,
            'data_before', CASE WHEN TG_OP = 'UPDATE' THEN OLD.data ELSE NULL END,
            'data_after', NEW.data));
  RETURN NEW;
END $function$;

-- 5. Atomic, locked, version-checked answer save
CREATE OR REPLACE FUNCTION public.takeover_save_answer(
  p_inspection_id uuid, p_group_key text, p_item_ref text,
  p_data jsonb, p_expected_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_ins public.takeover_inspections%ROWTYPE; v_cur public.takeover_answers%ROWTYPE;
BEGIN
  SELECT * INTO v_ins FROM public.takeover_inspections WHERE id = p_inspection_id FOR UPDATE;
  IF v_ins.id IS NULL THEN RETURN jsonb_build_object('error','Inspection not found'); END IF;
  IF NOT public.takeover_can_edit(p_inspection_id) THEN
    RETURN jsonb_build_object('error','You cannot edit this inspection');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.takeover_template_requirements r
                 WHERE r.template_id = v_ins.template_id AND r.template_version = v_ins.template_version
                   AND r.group_key = p_group_key AND r.item_ref = p_item_ref) THEN
    RETURN jsonb_build_object('error','Unknown checklist item for this template');
  END IF;

  IF p_expected_version IS NULL OR p_expected_version = 0 THEN
    INSERT INTO public.takeover_answers(inspection_id, group_key, item_ref, data, version, author_id, updated_by)
    VALUES (p_inspection_id, p_group_key, p_item_ref, COALESCE(p_data,'{}'::jsonb), 1, auth.uid(), auth.uid())
    ON CONFLICT (inspection_id, group_key, item_ref) DO NOTHING
    RETURNING * INTO v_cur;
    IF v_cur.id IS NOT NULL THEN
      RETURN jsonb_build_object('ok', true, 'version', v_cur.version, 'updated_at', v_cur.updated_at);
    END IF;
    SELECT * INTO v_cur FROM public.takeover_answers
     WHERE inspection_id = p_inspection_id AND group_key = p_group_key AND item_ref = p_item_ref;
    RETURN jsonb_build_object('conflict', true, 'version', v_cur.version, 'data', v_cur.data,
                              'updated_at', v_cur.updated_at);
  END IF;

  UPDATE public.takeover_answers
     SET data = COALESCE(p_data,'{}'::jsonb), version = version + 1
   WHERE inspection_id = p_inspection_id AND group_key = p_group_key AND item_ref = p_item_ref
     AND version = p_expected_version
  RETURNING * INTO v_cur;
  IF v_cur.id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'version', v_cur.version, 'updated_at', v_cur.updated_at);
  END IF;

  SELECT * INTO v_cur FROM public.takeover_answers
   WHERE inspection_id = p_inspection_id AND group_key = p_group_key AND item_ref = p_item_ref;
  IF v_cur.id IS NULL THEN
    RETURN jsonb_build_object('conflict', true, 'version', 0, 'data', '{}'::jsonb);
  END IF;
  RETURN jsonb_build_object('conflict', true, 'version', v_cur.version, 'data', v_cur.data,
                            'updated_at', v_cur.updated_at);
END $function$;

-- 6. Authoritative limitations, computed from the versioned template
CREATE OR REPLACE FUNCTION public.takeover_limitations(p_inspection_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_ins public.takeover_inspections%ROWTYPE; v jsonb;
BEGIN
  SELECT * INTO v_ins FROM public.takeover_inspections WHERE id = p_inspection_id;
  IF v_ins.id IS NULL THEN RETURN jsonb_build_object('error','Inspection not found'); END IF;
  IF NOT public.takeover_can_read(p_inspection_id) THEN
    RETURN jsonb_build_object('error','Not authorised');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.takeover_template_requirements r
                 WHERE r.template_id = v_ins.template_id AND r.template_version = v_ins.template_version) THEN
    RETURN jsonb_build_object('error','The source template for this inspection is not available on the server');
  END IF;

  WITH req AS (
    SELECT r.group_key, r.item_ref, r.photo_required
      FROM public.takeover_template_requirements r
     WHERE r.template_id = v_ins.template_id AND r.template_version = v_ins.template_version
  ), ans AS (
    SELECT a.group_key, a.item_ref, a.data
      FROM public.takeover_answers a
      JOIN req USING (group_key, item_ref)
     WHERE a.inspection_id = p_inspection_id
  ), ev AS (
    SELECT DISTINCT t.group_key, t.item_ref
      FROM public.takeover_attachments t
     WHERE t.inspection_id = p_inspection_id AND COALESCE(t.mime_type,'') LIKE 'image/%'
  ), j AS (
    SELECT req.group_key, req.item_ref, req.photo_required, ans.data,
      (CASE req.group_key
         WHEN 'master' THEN ans.data->>'result' IN ('pass','deficiency','na')
         WHEN 'spares' THEN ans.data->>'result' IN ('ok','shortfall')
         WHEN 'safety' THEN ans.data->>'status' IN ('satisfactory','deficiency')
         ELSE ans.data->>'status' IN ('valid','expired','missing')
       END) AS assessed,
      (ans.data IS NOT NULL AND ans.data <> '{}'::jsonb) AS recorded,
      EXISTS (SELECT 1 FROM ev WHERE ev.group_key = req.group_key AND ev.item_ref = req.item_ref) AS has_photo
    FROM req LEFT JOIN ans USING (group_key, item_ref)
  ), bad AS (
    SELECT group_key, item_ref FROM j
     WHERE (NULLIF(data->>'serviceable_qty','')::numeric >
            COALESCE(NULLIF(data->>'actual_qty','')::numeric, NULLIF(data->>'onboard_qty','')::numeric))
        OR NULLIF(data->>'actual_qty','')::numeric < 0
        OR NULLIF(data->>'onboard_qty','')::numeric < 0
        OR NULLIF(data->>'serviceable_qty','')::numeric < 0
        OR NULLIF(data->>'required_qty','')::numeric < 0
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM j),
    'unanswered', (SELECT count(*) FROM j WHERE NOT recorded),
    'unverified', (SELECT count(*) FROM j WHERE recorded AND NOT COALESCE(assessed,false)),
    'missing_photos', (SELECT count(*) FROM j WHERE photo_required AND NOT has_photo),
    'invalid_quantities', (SELECT count(*) FROM bad),
    'unanswered_items', COALESCE((SELECT jsonb_agg(group_key || ' ' || item_ref ORDER BY group_key, item_ref)
                                  FROM j WHERE NOT recorded), '[]'::jsonb),
    'unverified_items', COALESCE((SELECT jsonb_agg(group_key || ' ' || item_ref ORDER BY group_key, item_ref)
                                  FROM j WHERE recorded AND NOT COALESCE(assessed,false)), '[]'::jsonb),
    'missing_photo_items', COALESCE((SELECT jsonb_agg(group_key || ' ' || item_ref ORDER BY group_key, item_ref)
                                  FROM j WHERE photo_required AND NOT has_photo), '[]'::jsonb),
    'invalid_quantity_items', COALESCE((SELECT jsonb_agg(group_key || ' ' || item_ref ORDER BY group_key, item_ref)
                                  FROM bad), '[]'::jsonb)
  ) INTO v;
  RETURN v || jsonb_build_object('is_partial',
    ((v->>'unanswered')::int + (v->>'unverified')::int + (v->>'missing_photos')::int + (v->>'invalid_quantities')::int) > 0);
END $function$;

-- 7. Submit under the same row lock, with divergence check and honest PARTIAL marking
CREATE OR REPLACE FUNCTION public.takeover_submit(
  p_inspection_id uuid,
  p_limitation_note text DEFAULT NULL,
  p_expected_answer_count integer DEFAULT NULL,
  p_expected_version_sum bigint DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_row public.takeover_inspections%ROWTYPE; v_snap jsonb; v_lim jsonb;
        v_count integer; v_sum bigint; v_note text; v_partial boolean;
BEGIN
  SELECT * INTO v_row FROM public.takeover_inspections WHERE id = p_inspection_id FOR UPDATE;
  IF v_row.id IS NULL THEN RETURN jsonb_build_object('error','Inspection not found'); END IF;
  IF v_row.status = 'submitted' THEN RETURN jsonb_build_object('error','Already submitted and locked'); END IF;
  IF NOT public.takeover_can_edit(p_inspection_id) THEN
    RETURN jsonb_build_object('error','You cannot submit this inspection');
  END IF;

  SELECT count(*), COALESCE(sum(version),0) INTO v_count, v_sum
    FROM public.takeover_answers WHERE inspection_id = p_inspection_id;
  IF p_expected_answer_count IS NOT NULL
     AND (p_expected_answer_count <> v_count OR COALESCE(p_expected_version_sum,-1) <> v_sum) THEN
    RETURN jsonb_build_object('stale', true,
      'error','The server holds different answers than this device. Reload before submitting.',
      'server_answer_count', v_count);
  END IF;

  v_lim := public.takeover_limitations(p_inspection_id);
  IF v_lim ? 'error' THEN RETURN v_lim; END IF;
  v_partial := (v_lim->>'is_partial')::boolean;
  v_note := NULLIF(trim(COALESCE(p_limitation_note,'')),'');
  IF v_partial AND (v_note IS NULL OR length(v_note) < 20) THEN
    RETURN jsonb_build_object('error',
      'This is a partial inspection. Explain the limitation (at least 20 characters) before submitting.',
      'limitations', v_lim);
  END IF;

  SELECT jsonb_build_object(
      'template_id', v_row.template_id,
      'template_version', v_row.template_version,
      'is_partial', v_partial,
      'limitations', v_lim,
      'limitation_note', v_note,
      'submitted_by', auth.uid(),
      'submitted_at', now(),
      'inspection', to_jsonb(v_row),
      'answers', COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.group_key, a.item_ref)
                           FROM public.takeover_answers a WHERE a.inspection_id = p_inspection_id), '[]'::jsonb),
      'attachments', COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.photo_no)
                           FROM public.takeover_attachments t WHERE t.inspection_id = p_inspection_id), '[]'::jsonb))
    INTO v_snap;

  PERFORM set_config('takeover.submitting', 'on', true);
  UPDATE public.takeover_inspections
     SET status = 'submitted', submitted_by = auth.uid(), submitted_at = now(),
         submitted_snapshot = v_snap, is_partial = v_partial,
         limitation_note = COALESCE(v_note, limitation_note)
   WHERE id = p_inspection_id;
  PERFORM set_config('takeover.submitting', 'off', true);

  INSERT INTO public.takeover_audit(inspection_id, actor_id, action, entity, entity_id, detail)
  VALUES (p_inspection_id, auth.uid(), 'submit', 'inspection', p_inspection_id,
          jsonb_build_object('limitation_note', v_note, 'is_partial', v_partial, 'limitations', v_lim));
  RETURN jsonb_build_object('ok', true, 'is_partial', v_partial, 'limitations', v_lim);
END $function$;

-- 8. Close direct API write paths that bypass the versioned save / submit commands
DROP POLICY IF EXISTS "takeover answers insert scoped" ON public.takeover_answers;
DROP POLICY IF EXISTS "takeover answers update scoped" ON public.takeover_answers;
REVOKE INSERT, UPDATE, DELETE ON public.takeover_answers FROM authenticated;

DROP POLICY IF EXISTS "takeover insert admin only" ON public.takeover_inspections;
CREATE POLICY "takeover insert admin only"
  ON public.takeover_inspections FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid()) AND owner_id = auth.uid()
              AND status = 'draft' AND submitted_at IS NULL AND submitted_by IS NULL
              AND submitted_snapshot IS NULL AND is_partial = false);