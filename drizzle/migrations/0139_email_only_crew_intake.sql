CREATE OR REPLACE FUNCTION public.manager_lookup_crew_by_email(p_emails text[])
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE mp manager_profiles;
BEGIN
  SELECT * INTO mp FROM manager_profiles WHERE user_id = auth.uid();
  IF mp.id IS NULL OR NOT coalesce(mp.admin_approved,false) THEN RETURN '[]'::jsonb; END IF;
  IF coalesce(array_length(p_emails,1),0) > 500 THEN RETURN '[]'::jsonb; END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('email', lower(cp.email), 'first_name', cp.first_name, 'last_name', cp.last_name,
      'rank', cp.rank, 'nationality', cp.nationality, 'crew_unique_id', cp.crew_unique_id))
    FROM crew_profiles cp WHERE lower(cp.email) = ANY (SELECT lower(trim(e)) FROM unnest(p_emails) e) AND coalesce(cp.is_test,false) = false), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.manager_lookup_crew_by_email(text[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.manager_lookup_crew_by_email(text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.company_crew_import(p_rows jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE mp manager_profiles; r jsonb; v_email text; v_phone text; v_first text; v_last text; v_rank text; cp crew_profiles; v_ex uuid;
  created int := 0; skipped int := 0; invalid int := 0; updated int := 0; linked int := 0; ids jsonb := '[]'::jsonb; v_batch uuid := gen_random_uuid(); v_id uuid; v_cid text;
BEGIN
  SELECT * INTO mp FROM manager_profiles WHERE user_id = auth.uid();
  IF mp.id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not_a_manager'); END IF;
  IF NOT coalesce(mp.admin_approved,false) THEN RETURN jsonb_build_object('ok',false,'error','approval_required'); END IF;
  IF jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 THEN RETURN jsonb_build_object('ok',false,'error','no_rows'); END IF;
  IF jsonb_array_length(p_rows) > 1000 THEN RETURN jsonb_build_object('ok',false,'error','too_many_rows'); END IF;
  PERFORM set_config('app.company_crew_rpc','on',true);
  FOR r IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    v_first := left(trim(coalesce(r->>'first_name','')),80);
    v_last := left(trim(coalesce(r->>'last_name','')),80);
    v_rank := left(trim(coalesce(r->>'rank','')),80);
    v_email := nullif(lower(trim(coalesce(r->>'email',''))),'');
    v_phone := nullif(regexp_replace(coalesce(r->>'whatsapp',''),'[^\d+]','','g'),'');
    IF v_email IS NOT NULL AND v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' THEN v_email := NULL; END IF;
    cp := NULL;
    IF v_email IS NOT NULL THEN
      SELECT * INTO cp FROM crew_profiles WHERE lower(email) = v_email AND coalesce(is_test,false)=false LIMIT 1;
      IF cp.id IS NOT NULL THEN
        IF v_first = '' AND v_last = '' THEN v_first := left(coalesce(cp.first_name,''),80); v_last := left(coalesce(cp.last_name,''),80); END IF;
        IF v_rank = '' THEN v_rank := left(coalesce(cp.rank,''),80); END IF;
      END IF;
    END IF;
    -- email alone is enough; otherwise name + rank needed
    IF v_email IS NULL AND ((v_first = '' AND v_last = '') OR v_rank = '') THEN invalid := invalid + 1; CONTINUE; END IF;
    v_ex := NULL;
    IF v_email IS NOT NULL THEN SELECT id INTO v_ex FROM company_crew_records WHERE manager_id = auth.uid() AND lower(email) = v_email LIMIT 1; END IF;
    IF v_ex IS NULL AND v_phone IS NOT NULL THEN SELECT id INTO v_ex FROM company_crew_records WHERE manager_id = auth.uid() AND regexp_replace(whatsapp,'\D','','g') = regexp_replace(v_phone,'\D','','g') LIMIT 1; END IF;
    IF v_ex IS NOT NULL THEN
      -- enrich empty fields only; never overwrite what is already there
      UPDATE company_crew_records c SET
        first_name = CASE WHEN c.first_name = '' THEN v_first ELSE c.first_name END,
        last_name = CASE WHEN c.last_name = '' THEN v_last ELSE c.last_name END,
        rank = CASE WHEN c.rank = '' THEN v_rank ELSE c.rank END,
        nationality = coalesce(c.nationality, nullif(left(trim(coalesce(r->>'nationality','')),60),''), cp.nationality),
        email = coalesce(c.email, v_email), whatsapp = coalesce(c.whatsapp, v_phone),
        date_of_birth = coalesce(c.date_of_birth, CASE WHEN coalesce(r->>'date_of_birth','') ~ '^\d{4}-\d{2}-\d{2}$' THEN (r->>'date_of_birth')::date END),
        vessel = coalesce(c.vessel, nullif(left(trim(coalesce(r->>'vessel','')),120),'')),
        available_from = coalesce(c.available_from, CASE WHEN coalesce(r->>'available_from','') ~ '^\d{4}-\d{2}-\d{2}$' THEN (r->>'available_from')::date END),
        cdc_no = coalesce(c.cdc_no, nullif(left(trim(coalesce(r->>'cdc_no','')),40),'')),
        passport_no = coalesce(c.passport_no, nullif(left(trim(coalesce(r->>'passport_no','')),40),'')),
        notes = coalesce(c.notes, nullif(left(trim(coalesce(r->>'notes','')),1000),'')),
        sea_service = CASE WHEN jsonb_typeof(c.sea_service)='array' AND jsonb_array_length(c.sea_service)>0 THEN c.sea_service WHEN jsonb_typeof(r->'sea_service')='array' THEN r->'sea_service' ELSE '[]'::jsonb END,
        certificates = CASE WHEN jsonb_typeof(c.certificates)='array' AND jsonb_array_length(c.certificates)>0 THEN c.certificates WHEN jsonb_typeof(r->'certificates')='array' THEN r->'certificates' ELSE '[]'::jsonb END
      WHERE c.id = v_ex RETURNING crew_unique_id INTO v_cid;
      updated := updated + 1; IF cp.id IS NOT NULL THEN linked := linked + 1; END IF;
      ids := ids || jsonb_build_object('id', v_ex, 'crew_unique_id', v_cid, 'updated', true);
      CONTINUE;
    END IF;
    v_cid := public.next_crew_unique_id();
    INSERT INTO company_crew_records (manager_id, company_name, crew_unique_id, first_name, last_name, rank, nationality, email, whatsapp,
      date_of_birth, vessel, available_from, cdc_no, passport_no, notes, sea_service, certificates, import_batch)
    VALUES (auth.uid(), mp.company_name, v_cid, v_first, v_last, v_rank, coalesce(nullif(left(trim(coalesce(r->>'nationality','')),60),''), cp.nationality),
      v_email, v_phone,
      CASE WHEN coalesce(r->>'date_of_birth','') ~ '^\d{4}-\d{2}-\d{2}$' THEN (r->>'date_of_birth')::date END,
      nullif(left(trim(coalesce(r->>'vessel','')),120),''),
      CASE WHEN coalesce(r->>'available_from','') ~ '^\d{4}-\d{2}-\d{2}$' THEN (r->>'available_from')::date END,
      nullif(left(trim(coalesce(r->>'cdc_no','')),40),''), nullif(left(trim(coalesce(r->>'passport_no','')),40),''),
      nullif(left(trim(coalesce(r->>'notes','')),1000),''),
      CASE WHEN jsonb_typeof(r->'sea_service')='array' THEN r->'sea_service' ELSE '[]'::jsonb END,
      CASE WHEN jsonb_typeof(r->'certificates')='array' THEN r->'certificates' ELSE '[]'::jsonb END,
      v_batch)
    RETURNING id INTO v_id;
    created := created + 1; IF cp.id IS NOT NULL THEN linked := linked + 1; END IF;
    ids := ids || jsonb_build_object('id', v_id, 'crew_unique_id', v_cid);
  END LOOP;
  RETURN jsonb_build_object('ok',true,'created',created,'updated',updated,'linked',linked,'skipped',skipped,'invalid',invalid,'batch',v_batch,'records',ids);
END $function$;
NOTIFY pgrst, 'reload schema';