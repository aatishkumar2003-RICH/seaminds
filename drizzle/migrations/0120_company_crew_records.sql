CREATE TABLE public.company_crew_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL,
  company_name text,
  crew_unique_id text NOT NULL UNIQUE,
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  rank text NOT NULL DEFAULT '',
  nationality text,
  email text,
  whatsapp text,
  date_of_birth date,
  vessel text,
  available_from date,
  cdc_no text,
  passport_no text,
  notes text,
  sea_service jsonb NOT NULL DEFAULT '[]'::jsonb,
  certificates jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  claim_token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(18), 'hex'),
  invited_at timestamptz,
  invite_channel text,
  accepted_at timestamptz,
  declined_at timestamptz,
  crew_id uuid,
  import_batch uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX company_crew_records_mgr_email ON public.company_crew_records (manager_id, lower(email)) WHERE email IS NOT NULL AND email <> '';
CREATE UNIQUE INDEX company_crew_records_mgr_phone ON public.company_crew_records (manager_id, regexp_replace(whatsapp, '\D', '', 'g')) WHERE whatsapp IS NOT NULL AND regexp_replace(whatsapp, '\D', '', 'g') <> '';
CREATE INDEX company_crew_records_manager ON public.company_crew_records (manager_id, created_at DESC);
CREATE INDEX company_crew_records_crew ON public.company_crew_records (crew_id);

GRANT SELECT, UPDATE, DELETE ON public.company_crew_records TO authenticated;
GRANT ALL ON public.company_crew_records TO service_role;
ALTER TABLE public.company_crew_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY company_crew_select_own ON public.company_crew_records FOR SELECT TO authenticated USING (manager_id = auth.uid());
CREATE POLICY company_crew_update_own ON public.company_crew_records FOR UPDATE TO authenticated USING (manager_id = auth.uid()) WITH CHECK (manager_id = auth.uid());
CREATE POLICY company_crew_delete_own ON public.company_crew_records FOR DELETE TO authenticated USING (manager_id = auth.uid() AND status <> 'accepted');

-- Guard: managers can edit office data, never identity/consent fields.
CREATE OR REPLACE FUNCTION public.company_crew_record_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF current_setting('app.company_crew_rpc', true) = 'on' OR auth.role() = 'service_role' THEN
    NEW.updated_at := now(); RETURN NEW;
  END IF;
  NEW.manager_id := OLD.manager_id; NEW.crew_unique_id := OLD.crew_unique_id; NEW.claim_token := OLD.claim_token;
  NEW.status := OLD.status; NEW.accepted_at := OLD.accepted_at; NEW.declined_at := OLD.declined_at;
  NEW.crew_id := OLD.crew_id; NEW.company_name := OLD.company_name; NEW.created_at := OLD.created_at;
  NEW.invited_at := OLD.invited_at; NEW.invite_channel := OLD.invite_channel;
  IF jsonb_typeof(NEW.sea_service) <> 'array' THEN NEW.sea_service := '[]'::jsonb; END IF;
  IF jsonb_typeof(NEW.certificates) <> 'array' THEN NEW.certificates := '[]'::jsonb; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_company_crew_record_guard BEFORE UPDATE ON public.company_crew_records FOR EACH ROW EXECUTE FUNCTION public.company_crew_record_guard();

-- One shared crew ID sequence across real profiles and company-reserved IDs.
CREATE OR REPLACE FUNCTION public.next_crew_unique_id()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE y text := EXTRACT(YEAR FROM now())::text; n int; v text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('seaminds_crew_unique_id'));
  SELECT greatest(
    coalesce((SELECT max(substring(crew_unique_id from 'SM-\d{4}-(\d+)')::int) FROM crew_profiles WHERE crew_unique_id LIKE 'SM-' || y || '-%'), 0),
    coalesce((SELECT max(substring(crew_unique_id from 'SM-\d{4}-(\d+)')::int) FROM company_crew_records WHERE crew_unique_id LIKE 'SM-' || y || '-%'), 0)
  ) + 1 INTO n;
  LOOP
    v := 'SM-' || y || '-' || lpad(n::text, 5, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM crew_profiles WHERE crew_unique_id = v)
          AND NOT EXISTS (SELECT 1 FROM company_crew_records WHERE crew_unique_id = v);
    n := n + 1;
  END LOOP;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.next_crew_unique_id() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.generate_crew_unique_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.crew_unique_id IS NOT NULL THEN RETURN NEW; END IF;
  NEW.crew_unique_id := public.next_crew_unique_id();
  RETURN NEW;
END $$;

-- Bulk / single import (max 1000 rows per call). Approved managers only.
CREATE OR REPLACE FUNCTION public.company_crew_import(p_rows jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE mp manager_profiles; r jsonb; v_email text; v_phone text; v_first text; v_last text;
  created int := 0; skipped int := 0; invalid int := 0; ids jsonb := '[]'::jsonb; v_batch uuid := gen_random_uuid(); v_id uuid; v_cid text;
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
    v_email := nullif(lower(trim(coalesce(r->>'email',''))),'');
    v_phone := nullif(regexp_replace(coalesce(r->>'whatsapp',''),'[^\d+]','','g'),'');
    IF v_email IS NOT NULL AND v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' THEN v_email := NULL; END IF;
    IF v_first = '' AND v_last = '' OR trim(coalesce(r->>'rank','')) = '' THEN invalid := invalid + 1; CONTINUE; END IF;
    IF (v_email IS NOT NULL AND EXISTS (SELECT 1 FROM company_crew_records WHERE manager_id = auth.uid() AND lower(email) = v_email))
       OR (v_phone IS NOT NULL AND EXISTS (SELECT 1 FROM company_crew_records WHERE manager_id = auth.uid() AND regexp_replace(whatsapp,'\D','','g') = regexp_replace(v_phone,'\D','','g'))) THEN
      skipped := skipped + 1; CONTINUE;
    END IF;
    v_cid := public.next_crew_unique_id();
    INSERT INTO company_crew_records (manager_id, company_name, crew_unique_id, first_name, last_name, rank, nationality, email, whatsapp,
      date_of_birth, vessel, available_from, cdc_no, passport_no, notes, sea_service, certificates, import_batch)
    VALUES (auth.uid(), mp.company_name, v_cid, v_first, v_last, left(trim(r->>'rank'),80), nullif(left(trim(coalesce(r->>'nationality','')),60),''),
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
    created := created + 1; ids := ids || jsonb_build_object('id', v_id, 'crew_unique_id', v_cid);
  END LOOP;
  RETURN jsonb_build_object('ok',true,'created',created,'skipped',skipped,'invalid',invalid,'batch',v_batch,'records',ids);
END $$;
REVOKE ALL ON FUNCTION public.company_crew_import(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.company_crew_import(jsonb) TO authenticated;

-- Manager marks an invite as sent (WhatsApp / copy link) — email marking is done by the edge function.
CREATE OR REPLACE FUNCTION public.company_crew_mark_invited(p_ids uuid[], p_channel text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n int;
BEGIN
  IF p_channel NOT IN ('whatsapp','link','email') THEN RETURN 0; END IF;
  PERFORM set_config('app.company_crew_rpc','on',true);
  UPDATE company_crew_records SET status = CASE WHEN status = 'pending' THEN 'invited' ELSE status END,
    invited_at = now(), invite_channel = p_channel
  WHERE id = ANY(p_ids) AND manager_id = auth.uid() AND status IN ('pending','invited');
  GET DIAGNOSTICS n = ROW_COUNT; RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.company_crew_mark_invited(uuid[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.company_crew_mark_invited(uuid[], text) TO authenticated;

-- Public claim preview: token is the secret; no contact data returned.
CREATE OR REPLACE FUNCTION public.get_crew_claim(p_token text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT coalesce((SELECT jsonb_build_object('ok',true,'company',coalesce(r.company_name,'Your company'),
    'first_name',r.first_name,'last_name',r.last_name,'rank',r.rank,'nationality',r.nationality,'vessel',r.vessel,
    'crew_unique_id',r.crew_unique_id,'status',r.status,
    'sea_count', jsonb_array_length(r.sea_service), 'cert_count', jsonb_array_length(r.certificates),
    'email_hint', CASE WHEN r.email IS NULL THEN NULL ELSE left(r.email,2) || '•••@' || split_part(r.email,'@',2) END)
   FROM company_crew_records r WHERE r.claim_token = p_token AND length(p_token) >= 24),
   jsonb_build_object('ok',false));
$$;
GRANT EXECUTE ON FUNCTION public.get_crew_claim(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.decline_crew_claim(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n int;
BEGIN
  IF length(coalesce(p_token,'')) < 24 THEN RETURN jsonb_build_object('ok',false); END IF;
  PERFORM set_config('app.company_crew_rpc','on',true);
  UPDATE company_crew_records SET status = 'declined', declined_at = now()
  WHERE claim_token = p_token AND status IN ('pending','invited');
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN jsonb_build_object('ok', n > 0);
END $$;
GRANT EXECUTE ON FUNCTION public.decline_crew_claim(text) TO anon, authenticated;

-- Crew accepts: links record to their account, keeps own data, adds company-verified entries.
CREATE OR REPLACE FUNCTION public.accept_crew_claim(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r company_crew_records; cp crew_profiles; v_uid uuid := auth.uid(); mp_id uuid; d crew_cv_data;
  v_sea jsonb; v_certs jsonb; v_stamp jsonb; v_final_id text;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok',false,'error','sign_in_required'); END IF;
  IF EXISTS (SELECT 1 FROM manager_profiles WHERE user_id = v_uid) THEN RETURN jsonb_build_object('ok',false,'error','manager_account'); END IF;
  SELECT * INTO r FROM company_crew_records WHERE claim_token = p_token AND length(p_token) >= 24 FOR UPDATE;
  IF r.id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','invalid_link'); END IF;
  IF r.status = 'accepted' THEN
    RETURN jsonb_build_object('ok', r.crew_id = v_uid, 'error', CASE WHEN r.crew_id = v_uid THEN NULL ELSE 'already_claimed' END,
      'crew_unique_id', (SELECT crew_unique_id FROM crew_profiles WHERE id = r.crew_id));
  END IF;
  PERFORM public.ensure_crew_profile_for(v_uid);
  SELECT * INTO cp FROM crew_profiles WHERE id = v_uid;
  IF cp.id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','profile_missing'); END IF;

  -- New account (created after the company invite) takes the company-issued ID; existing crew keep theirs.
  IF cp.created_at >= r.created_at AND NOT EXISTS (SELECT 1 FROM crew_profiles WHERE crew_unique_id = r.crew_unique_id) THEN
    UPDATE crew_profiles SET crew_unique_id = r.crew_unique_id WHERE id = v_uid;
  END IF;
  UPDATE crew_profiles SET
    first_name = CASE WHEN coalesce(first_name,'') IN ('','Seafarer') AND r.first_name <> '' THEN r.first_name ELSE first_name END,
    last_name = CASE WHEN coalesce(last_name,'') = '' THEN r.last_name ELSE last_name END,
    role = CASE WHEN coalesce(role,'') IN ('','Seafarer') AND r.rank <> '' THEN r.rank ELSE role END,
    nationality = CASE WHEN coalesce(nationality,'') = '' THEN coalesce(r.nationality,'') ELSE nationality END,
    whatsapp_number = CASE WHEN coalesce(whatsapp_number,'') = '' THEN r.whatsapp ELSE whatsapp_number END
  WHERE id = v_uid;

  v_stamp := jsonb_build_object('company', r.company_name, 'manager_id', r.manager_id, 'record_id', r.id, 'verified_at', now());
  SELECT * INTO d FROM crew_cv_data WHERE user_id = v_uid;
  v_sea := CASE WHEN jsonb_typeof(d.sea_service)='array' THEN d.sea_service ELSE '[]'::jsonb END;
  v_certs := CASE WHEN jsonb_typeof(d.certificates)='array' THEN d.certificates ELSE '[]'::jsonb END;
  SELECT v_sea || coalesce(jsonb_agg(e || jsonb_build_object('verified_by', r.company_name, 'source','company')), '[]'::jsonb) INTO v_sea
  FROM jsonb_array_elements(r.sea_service) e
  WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_sea) x
    WHERE lower(coalesce(x->>'vessel_name',x->>'vessel','')) = lower(coalesce(e->>'vessel_name',e->>'vessel',''))
      AND coalesce(x->>'sign_on','') = coalesce(e->>'sign_on',''));
  SELECT v_certs || coalesce(jsonb_agg(e || jsonb_build_object('verified_by', r.company_name, 'source','company')), '[]'::jsonb) INTO v_certs
  FROM jsonb_array_elements(r.certificates) e
  WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_certs) x
    WHERE lower(coalesce(x->>'name','')) = lower(coalesce(e->>'name',''))
      AND coalesce(x->>'number','') = coalesce(e->>'number',''));
  INSERT INTO crew_cv_data (user_id, sea_service, certificates, medical, updated_at)
  VALUES (v_uid, v_sea, v_certs, jsonb_build_object('company_verified', jsonb_build_array(v_stamp)), now())
  ON CONFLICT (user_id) DO UPDATE SET sea_service = EXCLUDED.sea_service, certificates = EXCLUDED.certificates,
    medical = coalesce(crew_cv_data.medical,'{}'::jsonb) || jsonb_build_object('company_verified',
      CASE WHEN jsonb_typeof(crew_cv_data.medical->'company_verified')='array' THEN crew_cv_data.medical->'company_verified' ELSE '[]'::jsonb END || jsonb_build_array(v_stamp)),
    updated_at = now();

  SELECT id INTO mp_id FROM manager_profiles WHERE user_id = r.manager_id;
  IF mp_id IS NOT NULL THEN
    INSERT INTO company_fleet_links (manager_id, crew_id, status, source, linked_at)
    VALUES (mp_id, v_uid, 'active', 'company_roster', now())
    ON CONFLICT (manager_id, crew_id) DO UPDATE SET status = 'active', linked_at = now();
  END IF;

  PERFORM set_config('app.company_crew_rpc','on',true);
  UPDATE company_crew_records SET status = 'accepted', accepted_at = now(), crew_id = v_uid WHERE id = r.id;
  SELECT crew_unique_id INTO v_final_id FROM crew_profiles WHERE id = v_uid;
  INSERT INTO app_events (event_type, severity, message, metadata)
  VALUES ('company_crew_claimed','info','Crew accepted company roster profile', jsonb_build_object('record_id', r.id, 'manager_id', r.manager_id));
  RETURN jsonb_build_object('ok',true,'crew_unique_id',v_final_id,'company',r.company_name);
END $$;
REVOKE ALL ON FUNCTION public.accept_crew_claim(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_crew_claim(text) TO authenticated;

-- Live status view for the manager: canonical crew ID after claim.
CREATE OR REPLACE FUNCTION public.company_crew_list()
RETURNS SETOF jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT to_jsonb(r) - 'claim_token' || jsonb_build_object('claim_token', r.claim_token,
    'live_crew_unique_id', coalesce(cp.crew_unique_id, r.crew_unique_id))
  FROM company_crew_records r LEFT JOIN crew_profiles cp ON cp.id = r.crew_id
  WHERE r.manager_id = auth.uid()
  ORDER BY r.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.company_crew_list() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.company_crew_list() TO authenticated;