ALTER TABLE public.company_compliance
  ADD COLUMN IF NOT EXISTS responsible_person jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS business_license_path text,
  ADD COLUMN IF NOT EXISTS crewing_license_path text,
  ADD COLUMN IF NOT EXISTS ai_result jsonb,
  ADD COLUMN IF NOT EXISTS ai_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_runs_day date,
  ADD COLUMN IF NOT EXISTS ai_runs integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.submit_company_verification(
  p_license text, p_website text, p_person jsonb, p_business_path text, p_crewing_path text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_status text;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM manager_profiles WHERE user_id = v_uid) THEN RAISE EXCEPTION 'not_manager'; END IF;
  IF coalesce(trim(p_license),'') = '' OR coalesce(trim(p_website),'') = '' THEN RAISE EXCEPTION 'licence_and_website_required'; END IF;
  IF coalesce(trim(p_person->>'name'),'') = '' OR coalesce(trim(p_person->>'email'),'') = '' OR coalesce(trim(p_person->>'phone'),'') = '' THEN RAISE EXCEPTION 'responsible_person_required'; END IF;
  IF split_part(coalesce(p_business_path,''),'/',1) <> v_uid::text OR split_part(coalesce(p_crewing_path,''),'/',1) <> v_uid::text THEN RAISE EXCEPTION 'both_documents_required'; END IF;
  SELECT status INTO v_status FROM company_compliance WHERE manager_user_id = v_uid;
  IF v_status = 'verified' THEN RAISE EXCEPTION 'already_verified'; END IF;
  INSERT INTO company_compliance(manager_user_id,status,license_number,website,responsible_person,business_license_path,crewing_license_path,document_paths,submitted_at,updated_at)
  VALUES (v_uid,'ai_review',left(p_license,200),left(p_website,300),
    jsonb_build_object('name',left(p_person->>'name',150),'title',left(coalesce(p_person->>'title',''),150),'email',left(p_person->>'email',200),'phone',left(p_person->>'phone',50)),
    p_business_path,p_crewing_path,ARRAY[p_business_path,p_crewing_path],now(),now())
  ON CONFLICT (manager_user_id) DO UPDATE SET status='ai_review', license_number=EXCLUDED.license_number, website=EXCLUDED.website,
    responsible_person=EXCLUDED.responsible_person, business_license_path=EXCLUDED.business_license_path, crewing_license_path=EXCLUDED.crewing_license_path,
    document_paths=(SELECT array_agg(DISTINCT x) FROM unnest(company_compliance.document_paths || EXCLUDED.document_paths) x),
    submitted_at=now(), updated_at=now();
  RETURN jsonb_build_object('ok',true);
END $$;
REVOKE ALL ON FUNCTION public.submit_company_verification(text,text,jsonb,text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.submit_company_verification(text,text,jsonb,text,text) TO authenticated;