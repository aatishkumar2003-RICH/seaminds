ALTER TABLE public.manager_training_invites ADD COLUMN IF NOT EXISTS slugs text[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public._mgr_assign_modules(p_manager uuid, p_crew uuid, p_slugs text[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s text; m record; n integer := 0;
BEGIN
  IF p_slugs IS NULL THEN RETURN 0; END IF;
  FOREACH s IN ARRAY p_slugs[1:10] LOOP
    SELECT id, version INTO m FROM training_modules WHERE slug = s AND is_published;
    CONTINUE WHEN m.id IS NULL;
    INSERT INTO crew_training_assignments(crew_id, module_id, module_version, source, assigned_by, reasons, match_score)
    VALUES (p_crew, m.id, m.version, 'manager', p_manager, '["Requested by your company"]'::jsonb, 0)
    ON CONFLICT (crew_id, module_id) DO UPDATE SET assigned_by = EXCLUDED.assigned_by, source = 'manager'
      WHERE crew_training_assignments.status <> 'completed' AND crew_training_assignments.source = 'self';
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public._mgr_assign_modules(uuid, uuid, text[]) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.manager_assign_training(p_email text, p_phone text DEFAULT NULL, p_slugs text[] DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_ok boolean; v_email text := lower(trim(coalesce(p_email,'')));
  v_digits text := regexp_replace(coalesce(p_phone,''), '\D', '', 'g'); v_crew uuid; v_n integer := 0;
BEGIN
  SELECT coalesce(admin_approved,false) INTO v_ok FROM manager_profiles WHERE user_id = v_uid;
  IF NOT coalesce(v_ok,false) THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_APPROVED'); END IF;
  IF v_email <> '' THEN SELECT id INTO v_crew FROM crew_profiles WHERE lower(email) = v_email LIMIT 1; END IF;
  IF v_crew IS NULL AND length(v_digits) >= 8 THEN
    SELECT id INTO v_crew FROM crew_profiles WHERE right(regexp_replace(coalesce(whatsapp_number,''), '\D', '', 'g'), 9) = right(v_digits, 9) LIMIT 1;
  END IF;
  IF v_crew IS NOT NULL AND v_crew <> v_uid THEN
    INSERT INTO manager_training_links (manager_id, crew_id, source) VALUES (v_uid, v_crew, 'invite_sent') ON CONFLICT DO NOTHING;
    v_n := _mgr_assign_modules(v_uid, v_crew, p_slugs);
    RETURN jsonb_build_object('ok', true, 'linked', true, 'assigned', v_n);
  END IF;
  IF v_email LIKE '%@%' THEN
    INSERT INTO manager_training_invites (manager_id, email, slugs) VALUES (v_uid, v_email, coalesce(p_slugs,'{}'))
    ON CONFLICT (manager_id, email) DO UPDATE SET slugs = (SELECT array_agg(DISTINCT x) FROM unnest(manager_training_invites.slugs || EXCLUDED.slugs) x);
  END IF;
  RETURN jsonb_build_object('ok', true, 'linked', false, 'assigned', 0, 'pending', v_email LIKE '%@%');
END $$;
REVOKE ALL ON FUNCTION public.manager_assign_training(text, text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manager_assign_training(text, text, text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.link_pending_training_invites()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r record;
BEGIN
  IF NEW.email IS NOT NULL THEN
    FOR r IN SELECT manager_id, slugs FROM manager_training_invites WHERE email = lower(NEW.email) LOOP
      INSERT INTO manager_training_links (manager_id, crew_id, source) VALUES (r.manager_id, NEW.id, 'invite_signup') ON CONFLICT DO NOTHING;
      BEGIN PERFORM _mgr_assign_modules(r.manager_id, NEW.id, r.slugs);
      EXCEPTION WHEN OTHERS THEN RAISE WARNING 'pending training assign skipped: %', SQLERRM; END;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
NOTIFY pgrst, 'reload schema';