CREATE OR REPLACE FUNCTION public.ensure_crew_profile_for(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u record; v_name text;
BEGIN
  IF p_id IS NULL OR p_id <> auth.uid() THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM crew_profiles WHERE id = p_id) THEN RETURN; END IF;
  SELECT email, raw_user_meta_data m INTO u FROM auth.users WHERE id = p_id;
  IF NOT FOUND THEN RETURN; END IF;
  v_name := COALESCE(u.m->>'name', u.m->>'full_name', '');
  INSERT INTO crew_profiles (id, first_name, last_name, role, ship_name, nationality, onboarding_complete)
  VALUES (p_id,
    COALESCE(NULLIF(u.m->>'first_name',''), NULLIF(u.m->>'given_name',''), NULLIF(split_part(v_name,' ',1),''), initcap(split_part(u.email,'@',1)), 'Seafarer'),
    COALESCE(NULLIF(u.m->>'last_name',''), NULLIF(u.m->>'family_name',''), ''),
    'Seafarer', 'Not on vessel', COALESCE(u.m->>'nationality',''), false)
  ON CONFLICT (id) DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.ensure_crew_profile_for(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_crew_profile_for(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.trg_ensure_crew_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.ensure_crew_profile_for((to_jsonb(NEW)->>TG_ARGV[0])::uuid);
  RETURN NEW;
END $$;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('chat_messages','crew_profile_id'),('crew_availability','crew_profile_id'),
    ('crew_feedback','profile_id'),('interview_pre_form','crew_profile_id'),
    ('bridge_pocket','crew_profile_id'),('rest_hours_data','crew_profile_id')) v(t,c)
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS zz_ensure_crew_profile ON public.%I', r.t);
    EXECUTE format('CREATE TRIGGER aa_ensure_crew_profile BEFORE INSERT OR UPDATE OF %I ON public.%I FOR EACH ROW EXECUTE FUNCTION public.trg_ensure_crew_profile(%L)', r.c, r.t, r.c);
  END LOOP;
END $$;