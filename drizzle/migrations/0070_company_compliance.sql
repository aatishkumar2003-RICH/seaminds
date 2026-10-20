CREATE TABLE public.company_compliance (
  manager_user_id uuid PRIMARY KEY,
  status text NOT NULL DEFAULT 'none',
  requested_items text[] NOT NULL DEFAULT '{}',
  admin_note text,
  requested_at timestamptz,
  license_number text,
  website text,
  manager_note text,
  document_paths text[] NOT NULL DEFAULT '{}',
  submitted_at timestamptz,
  reviewed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.company_compliance TO authenticated;
GRANT ALL ON public.company_compliance TO service_role;
ALTER TABLE public.company_compliance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Manager reads own compliance" ON public.company_compliance FOR SELECT TO authenticated USING (manager_user_id = auth.uid());
CREATE POLICY "Admin reads compliance" ON public.company_compliance FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.admin_request_company_docs(p_manager uuid, p_items text[], p_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_admin'; END IF;
  IF coalesce(array_length(p_items,1),0) = 0 THEN RAISE EXCEPTION 'no_items'; END IF;
  INSERT INTO company_compliance(manager_user_id,status,requested_items,admin_note,requested_at,updated_at)
  VALUES (p_manager,'requested',p_items,left(p_note,1000),now(),now())
  ON CONFLICT (manager_user_id) DO UPDATE SET status='requested', requested_items=EXCLUDED.requested_items,
    admin_note=EXCLUDED.admin_note, requested_at=now(), updated_at=now();
  RETURN jsonb_build_object('ok',true);
END $$;

CREATE OR REPLACE FUNCTION public.submit_company_compliance(p_license text, p_website text, p_note text, p_paths text[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); p text;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM manager_profiles WHERE user_id = v_uid) THEN RAISE EXCEPTION 'not_manager'; END IF;
  FOREACH p IN ARRAY coalesce(p_paths,'{}') LOOP
    IF split_part(p,'/',1) <> v_uid::text THEN RAISE EXCEPTION 'bad_path'; END IF;
  END LOOP;
  INSERT INTO company_compliance(manager_user_id,status,license_number,website,manager_note,document_paths,submitted_at,updated_at)
  VALUES (v_uid,'submitted',left(p_license,200),left(p_website,300),left(p_note,1000),coalesce(p_paths,'{}'),now(),now())
  ON CONFLICT (manager_user_id) DO UPDATE SET status='submitted',
    license_number=coalesce(nullif(EXCLUDED.license_number,''),company_compliance.license_number),
    website=coalesce(nullif(EXCLUDED.website,''),company_compliance.website),
    manager_note=EXCLUDED.manager_note,
    document_paths=(SELECT array_agg(DISTINCT x) FROM unnest(company_compliance.document_paths || EXCLUDED.document_paths) x),
    submitted_at=now(), updated_at=now();
  RETURN jsonb_build_object('ok',true);
END $$;

CREATE OR REPLACE FUNCTION public.admin_mark_compliance_verified(p_manager uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_admin'; END IF;
  INSERT INTO company_compliance(manager_user_id,status,reviewed_at) VALUES (p_manager,'verified',now())
  ON CONFLICT (manager_user_id) DO UPDATE SET status='verified', reviewed_at=now(), updated_at=now();
  RETURN jsonb_build_object('ok',true);
END $$;
REVOKE ALL ON FUNCTION public.admin_request_company_docs(uuid,text[],text), public.submit_company_compliance(text,text,text,text[]), public.admin_mark_compliance_verified(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_request_company_docs(uuid,text[],text), public.submit_company_compliance(text,text,text,text[]), public.admin_mark_compliance_verified(uuid) TO authenticated;

CREATE POLICY "Managers upload own company docs" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='company-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Managers read own company docs" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='company-documents' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin(auth.uid())));

-- WhatsApp approval sync to crew profile
CREATE OR REPLACE FUNCTION public.sync_mobile_verification_to_crew()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
    IF NEW.verification_status = 'verified' THEN
      UPDATE crew_profiles SET whatsapp_verified = true, whatsapp_verified_at = now() WHERE id = NEW.user_id;
    ELSIF OLD.verification_status = 'verified' THEN
      UPDATE crew_profiles SET whatsapp_verified = false, whatsapp_verified_at = NULL WHERE id = NEW.user_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_sync_mobile_verification ON public.mobile_verifications;
CREATE TRIGGER trg_sync_mobile_verification AFTER UPDATE ON public.mobile_verifications
  FOR EACH ROW EXECUTE FUNCTION public.sync_mobile_verification_to_crew();
UPDATE public.crew_profiles c SET whatsapp_verified = true, whatsapp_verified_at = coalesce(m.verified_at, now())
  FROM public.mobile_verifications m WHERE m.user_id = c.id AND m.verification_status='verified' AND coalesce(c.whatsapp_verified,false)=false;