CREATE TABLE IF NOT EXISTS public.manager_training_invites (
  manager_id uuid NOT NULL,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (manager_id, email)
);
GRANT SELECT ON public.manager_training_invites TO authenticated;
GRANT ALL ON public.manager_training_invites TO service_role;
ALTER TABLE public.manager_training_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mti read own" ON public.manager_training_invites FOR SELECT TO authenticated USING (manager_id = auth.uid());

-- Approved manager sends a training invite: link existing crew now, or remember the email for sign-up.
CREATE OR REPLACE FUNCTION public.manager_link_training_crew(p_email text, p_phone text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_ok boolean; v_email text := lower(trim(coalesce(p_email,'')));
  v_digits text := regexp_replace(coalesce(p_phone,''), '\D', '', 'g'); v_crew uuid;
BEGIN
  SELECT coalesce(admin_approved,false) INTO v_ok FROM manager_profiles WHERE user_id = v_uid;
  IF NOT coalesce(v_ok,false) THEN RETURN jsonb_build_object('ok', false, 'error', 'NOT_APPROVED'); END IF;
  IF v_email <> '' THEN SELECT id INTO v_crew FROM crew_profiles WHERE lower(email) = v_email LIMIT 1; END IF;
  IF v_crew IS NULL AND length(v_digits) >= 8 THEN
    SELECT id INTO v_crew FROM crew_profiles WHERE right(regexp_replace(coalesce(whatsapp_number,''), '\D', '', 'g'), 9) = right(v_digits, 9) LIMIT 1;
  END IF;
  IF v_crew IS NOT NULL AND v_crew <> v_uid THEN
    INSERT INTO manager_training_links (manager_id, crew_id, source) VALUES (v_uid, v_crew, 'invite_sent') ON CONFLICT DO NOTHING;
    RETURN jsonb_build_object('ok', true, 'linked', true);
  END IF;
  IF v_email LIKE '%@%' THEN
    INSERT INTO manager_training_invites (manager_id, email) VALUES (v_uid, v_email) ON CONFLICT DO NOTHING;
  END IF;
  RETURN jsonb_build_object('ok', true, 'linked', false);
END $$;
REVOKE ALL ON FUNCTION public.manager_link_training_crew(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.manager_link_training_crew(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.link_pending_training_invites()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.email IS NOT NULL THEN
    INSERT INTO manager_training_links (manager_id, crew_id, source)
      SELECT manager_id, NEW.id, 'invite_signup' FROM manager_training_invites WHERE email = lower(NEW.email)
      ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_link_pending_training_invites ON public.crew_profiles;
CREATE TRIGGER trg_link_pending_training_invites AFTER INSERT OR UPDATE OF email ON public.crew_profiles
  FOR EACH ROW EXECUTE FUNCTION public.link_pending_training_invites();

INSERT INTO public.manager_training_links (manager_id, crew_id, source)
VALUES ('c2ed2651-d4ce-4508-95e3-862d2f03091b', '97abb851-7b6c-4f0f-8423-bd409f3be5d7', 'owner_backfill')
ON CONFLICT DO NOTHING;