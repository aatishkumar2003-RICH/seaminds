CREATE OR REPLACE FUNCTION public.admin_bulk_import_vacancies(_rows jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r jsonb; n integer := 0; k text;
BEGIN
  IF auth.uid() IS DISTINCT FROM '492ee966-e015-4440-a415-6ad6275a4a9b'::uuid THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF jsonb_typeof(_rows) <> 'array' OR jsonb_array_length(_rows) > 300 THEN
    RAISE EXCEPTION 'rows must be an array of at most 300';
  END IF;
  FOR r IN SELECT * FROM jsonb_array_elements(_rows) LOOP
    CONTINUE WHEN coalesce(r->>'rank_required','') = '';
    k := lower(concat_ws('|','admin-import',r->>'company_name',r->>'rank_required',r->>'vessel_type',left(coalesce(r->>'description',''),40)));
    CONTINUE WHEN EXISTS (SELECT 1 FROM external_vacancies WHERE dedup_key = k AND archived_at IS NULL);
    INSERT INTO external_vacancies (source, external_id, title, rank_required, vessel_type, company_name, description,
      contact_whatsapp, contact_email, apply_url, salary_text, joining_port, quality_score, is_verified, is_scam_flagged,
      fetched_at, expires_at, source_posted_at, dedup_key)
    VALUES ('internal', 'admin-' || gen_random_uuid(),
      (r->>'rank_required') || coalesce(' — ' || nullif(r->>'vessel_type',''), ''),
      r->>'rank_required', nullif(r->>'vessel_type',''), nullif(r->>'company_name',''), nullif(r->>'description',''),
      nullif(r->>'contact_whatsapp',''), nullif(r->>'contact_email',''), nullif(r->>'apply_url',''),
      nullif(r->>'salary_text',''), nullif(r->>'joining_port',''), 70, true, false,
      now(), now() + interval '60 days', current_date, k);
    n := n + 1;
  END LOOP;
  INSERT INTO app_events (event_type, message, metadata) VALUES ('admin_bulk_import', 'Admin vacancy import', jsonb_build_object('saved', n));
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.admin_bulk_import_vacancies(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_bulk_import_vacancies(jsonb) TO authenticated;