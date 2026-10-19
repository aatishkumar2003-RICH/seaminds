CREATE OR REPLACE FUNCTION public.training_assign(p_invite_id uuid DEFAULT NULL::uuid, p_slugs text[] DEFAULT NULL::text[], p_area text DEFAULT NULL::text, p_application_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE who jsonb; rec jsonb; crew uuid; area text := nullif(upper(btrim(p_area)), ''); item jsonb; m record; outp jsonb := '[]'::jsonb; a record; s text;
BEGIN
  who := training_resolve_crew(p_invite_id, p_application_id);
  IF NOT (who->>'ok')::boolean THEN RETURN who; END IF;
  crew := (who->>'crew_id')::uuid;
  IF p_slugs IS NOT NULL AND cardinality(p_slugs) > 5 THEN RETURN jsonb_build_object('ok', false, 'error_code', 'TOO_MANY'); END IF;
  -- Crew self-enrolment: any published module, own record only; never alters a company assignment.
  IF who->>'source' = 'self' THEN
    IF p_slugs IS NULL OR cardinality(p_slugs) = 0 THEN RETURN jsonb_build_object('ok', false, 'error_code', 'NOTHING_TO_ASSIGN'); END IF;
    FOREACH s IN ARRAY p_slugs LOOP
      SELECT id, version, title INTO m FROM training_modules WHERE slug = s AND is_published;
      CONTINUE WHEN m.id IS NULL;
      INSERT INTO crew_training_assignments(crew_id, module_id, module_version, source, assigned_by, reasons, match_score)
      VALUES (crew, m.id, m.version, 'self', crew, '["Chosen by you from the training matrix"]'::jsonb, 0)
      ON CONFLICT (crew_id, module_id) DO NOTHING;
      SELECT token, status INTO a FROM crew_training_assignments WHERE crew_id = crew AND module_id = m.id;
      outp := outp || jsonb_build_object('slug', s, 'title', m.title, 'status', a.status, 'token', a.token);
    END LOOP;
    IF jsonb_array_length(outp) = 0 THEN RETURN jsonb_build_object('ok', false, 'error_code', 'NOTHING_TO_ASSIGN'); END IF;
    RETURN jsonb_build_object('ok', true, 'assigned', outp);
  END IF;
  rec := training_recommend_core(crew, area, who->>'vessel', 10);
  FOR item IN SELECT e FROM jsonb_array_elements(rec->'items') e
     WHERE (p_slugs IS NULL AND (e->>'score')::int > 0) OR (p_slugs IS NOT NULL AND e->>'slug' = ANY(p_slugs))
     LIMIT CASE WHEN p_slugs IS NULL THEN 2 ELSE 5 END
  LOOP
    SELECT id, version INTO m FROM training_modules WHERE slug = item->>'slug' AND is_published;
    INSERT INTO crew_training_assignments(crew_id, module_id, module_version, source, assigned_by, invite_id, application_id, trading_area, reasons, match_score)
    VALUES (crew, m.id, m.version, who->>'source', auth.uid(), p_invite_id, p_application_id, area, item->'reasons', (item->>'score')::int)
    ON CONFLICT (crew_id, module_id) DO UPDATE
      SET module_version = EXCLUDED.module_version, status = 'assigned', opened_at = NULL, completed_at = NULL,
          quiz_correct = NULL, quiz_total = NULL, attempts = 0, reasons = EXCLUDED.reasons, match_score = EXCLUDED.match_score
      WHERE crew_training_assignments.status = 'completed' AND crew_training_assignments.module_version < EXCLUDED.module_version;
    SELECT token, status, assigned_by INTO a FROM crew_training_assignments WHERE crew_id = crew AND module_id = m.id;
    outp := outp || jsonb_build_object('slug', item->>'slug', 'title', item->>'title', 'status', a.status,
      'token', CASE WHEN a.assigned_by = auth.uid() OR who->>'source' = 'admin' THEN a.token END);
  END LOOP;
  IF jsonb_array_length(outp) = 0 THEN RETURN jsonb_build_object('ok', false, 'error_code', 'NOTHING_TO_ASSIGN'); END IF;
  RETURN jsonb_build_object('ok', true, 'assigned', outp);
END $function$;

-- Interview scored -> auto-assign up to 2 refresher modules for exam-gap domains, on behalf of the campaign manager.
CREATE OR REPLACE FUNCTION public.training_auto_assign_on_score()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r record; rec jsonb; item jsonb; m record;
BEGIN
  IF NEW.crew_profile_id IS NULL OR NEW.overall_score IS NULL OR OLD.overall_score IS NOT NULL THEN RETURN NEW; END IF;
  BEGIN
    SELECT c.manager_id, c.vessel_type INTO r FROM interview_campaigns c WHERE c.id = NEW.campaign_id;
    IF r.manager_id IS NULL THEN RETURN NEW; END IF;
    rec := training_recommend_core(NEW.crew_profile_id, NULL, r.vessel_type, 10);
    FOR item IN SELECT e FROM jsonb_array_elements(rec->'items') e WHERE (e->>'gap')::boolean LIMIT 2 LOOP
      SELECT id, version INTO m FROM training_modules WHERE slug = item->>'slug' AND is_published;
      CONTINUE WHEN m.id IS NULL;
      INSERT INTO crew_training_assignments(crew_id, module_id, module_version, source, assigned_by, invite_id, reasons, match_score)
      VALUES (NEW.crew_profile_id, m.id, m.version, 'manager', r.manager_id, NEW.id,
              jsonb_build_array('Auto-assigned after interview') || coalesce(item->'reasons', '[]'::jsonb), (item->>'score')::int)
      ON CONFLICT (crew_id, module_id) DO NOTHING;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'training auto-assign skipped: %', SQLERRM; -- never block scoring
  END;
  RETURN NEW;
END $function$;
REVOKE ALL ON FUNCTION public.training_auto_assign_on_score() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_training_auto_assign ON public.interview_invites;
CREATE TRIGGER trg_training_auto_assign AFTER UPDATE OF overall_score ON public.interview_invites
  FOR EACH ROW EXECUTE FUNCTION public.training_auto_assign_on_score();
NOTIFY pgrst, 'reload schema';