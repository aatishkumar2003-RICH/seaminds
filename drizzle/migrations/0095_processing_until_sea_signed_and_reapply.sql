ALTER TABLE public.job_applications
  ADD COLUMN IF NOT EXISTS decline_reason text,
  ADD COLUMN IF NOT EXISTS crew_remark text,
  ADD COLUMN IF NOT EXISTS crew_remark_at timestamptz,
  ADD COLUMN IF NOT EXISTS reapplied_at timestamptz;

-- Reapply: refresh a closed application instead of duplicating; still-open ones stay single.
CREATE OR REPLACE FUNCTION public.submit_application(p_vacancy_id uuid DEFAULT NULL::uuid, p_company_post_id uuid DEFAULT NULL::uuid, p_company_name text DEFAULT NULL::text, p_rank text DEFAULT NULL::text, p_vessel text DEFAULT NULL::text, p_external_url text DEFAULT NULL::text, p_job_posting_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); existing job_applications%ROWTYPE; readiness jsonb; new_id uuid;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_signed_in'); END IF;
  IF p_vacancy_id IS NULL AND p_company_post_id IS NULL AND p_job_posting_id IS NULL
     AND coalesce(p_external_url,'') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_target'); END IF;

  SELECT * INTO existing FROM job_applications
   WHERE crew_id = uid
     AND ((p_vacancy_id IS NOT NULL AND vacancy_id = p_vacancy_id)
       OR (p_company_post_id IS NOT NULL AND company_post_id = p_company_post_id)
       OR (p_job_posting_id IS NOT NULL AND job_posting_id = p_job_posting_id)
       OR (p_vacancy_id IS NULL AND p_company_post_id IS NULL AND p_job_posting_id IS NULL
           AND external_url = p_external_url AND created_at > now() - interval '14 days'))
   ORDER BY created_at DESC LIMIT 1;

  readiness := public.cv_interview_readiness(uid, p_rank);

  IF existing.id IS NOT NULL THEN
    IF existing.outcome IN ('declined','offer_declined','withdrawn') THEN
      UPDATE job_applications SET outcome = 'awaiting', reapplied_at = now(), decline_reason = NULL,
        had_cv = COALESCE((readiness->>'service_entries')::int, 0) > 0,
        cv_complete = COALESCE((readiness->>'ready')::boolean, false)
       WHERE id = existing.id;
      RETURN jsonb_build_object('ok', true, 'duplicate', false, 'reapplied', true, 'application_id', existing.id,
        'cv_complete', COALESCE((readiness->>'ready')::boolean, false));
    END IF;
    -- still open: silently refresh evidence, never re-alert the recruiter
    UPDATE job_applications SET had_cv = COALESCE((readiness->>'service_entries')::int, 0) > 0,
      cv_complete = COALESCE((readiness->>'ready')::boolean, false) WHERE id = existing.id;
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'outcome', existing.outcome,
      'under_review', existing.outcome IN ('awaiting','shortlisted','offered','accepted'),
      'application_id', existing.id);
  END IF;

  INSERT INTO job_applications (crew_id, vacancy_id, company_post_id, job_posting_id, company_name,
    rank_applied, vessel_type, apply_method, had_cv, cv_complete, external_url, outcome)
  VALUES (uid, p_vacancy_id, p_company_post_id, p_job_posting_id, p_company_name, p_rank, p_vessel,
    CASE WHEN p_job_posting_id IS NOT NULL THEN 'seaminds_direct'
         WHEN p_external_url IS NOT NULL THEN 'external' ELSE 'seaminds' END,
    COALESCE((readiness->>'service_entries')::int, 0) > 0,
    COALESCE((readiness->>'ready')::boolean, false), p_external_url, 'awaiting')
  RETURNING id INTO new_id;

  INSERT INTO app_events (event_type, message, severity, metadata)
  VALUES ('job_application', 'Crew applied to a vacancy', 'info',
    jsonb_build_object('application_id', new_id, 'rank', p_rank, 'company', p_company_name,
                       'direct', p_job_posting_id IS NOT NULL));

  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'application_id', new_id,
    'cv_complete', COALESCE((readiness->>'ready')::boolean, false));
END; $function$;

-- Accepting an offer = Processing. No lock; crew stays free until SEA is signed.
CREATE OR REPLACE FUNCTION public.crew_respond_offer(p_application_id uuid, p_accept boolean)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); app job_applications%ROWTYPE; v_duration text; v_months int; v_join date;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_signed_in'); END IF;
  SELECT * INTO app FROM job_applications WHERE id = p_application_id AND crew_id = uid;
  IF app.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  IF app.outcome <> 'offered' THEN RETURN jsonb_build_object('ok', false, 'error', 'not_offered'); END IF;
  IF p_accept THEN
    IF app.job_posting_id IS NOT NULL THEN
      SELECT jp.contract_duration INTO v_duration FROM job_postings jp WHERE jp.id = app.job_posting_id; END IF;
    IF v_duration IS NULL AND app.vacancy_id IS NOT NULL THEN
      SELECT ev.contract_duration INTO v_duration FROM external_vacancies ev WHERE ev.id = app.vacancy_id; END IF;
    v_months := nullif((regexp_match(coalesce(v_duration,''), '(\d+)'))[1], '')::int;
    IF v_months IS NULL OR v_months < 1 THEN v_months := 9; END IF;
    v_join := coalesce(nullif(app.offer_details->>'joining_date','')::date, app.offered_joining_date, current_date);
    UPDATE job_applications SET outcome = 'accepted', crew_accepted_at = now(),
      placement_end = (v_join + (v_months * interval '1 month'))::date WHERE id = app.id;
    INSERT INTO notifications (crew_id, kind, title, body, icon, screen) VALUES
      (uid, 'application_update', '⏳ Offer accepted — processing',
       coalesce(app.company_name,'The company') || ' is preparing your contract (SEA). You stay free until you sign it.', '⏳', 'jobs');
  ELSE
    UPDATE job_applications SET outcome = 'offer_declined' WHERE id = app.id;
  END IF;
  RETURN jsonb_build_object('ok', true, 'processing', p_accept, 'placed', false);
END $function$;

-- Crew remark / thanks to the manager
CREATE OR REPLACE FUNCTION public.crew_send_remark(p_application_id uuid, p_remark text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); r text := left(trim(coalesce(p_remark,'')), 300);
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_signed_in'); END IF;
  IF r = '' THEN RETURN jsonb_build_object('ok', false, 'error', 'empty'); END IF;
  UPDATE job_applications SET crew_remark = r, crew_remark_at = now()
   WHERE id = p_application_id AND crew_id = uid
     AND (crew_remark_at IS NULL OR crew_remark_at < now() - interval '1 minute');
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not_allowed'); END IF;
  RETURN jsonb_build_object('ok', true);
END $function$;
REVOKE ALL ON FUNCTION public.crew_send_remark(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.crew_send_remark(uuid, text) TO authenticated;

-- Manager decline carries a reason shown to crew
CREATE OR REPLACE FUNCTION public.manager_update_application(p_application_id uuid, p_action text, p_joining_date date DEFAULT NULL::date, p_contract_months integer DEFAULT 9, p_offer jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid(); app job_applications%ROWTYPE;
  is_admin boolean := uid = '492ee966-e015-4440-a415-6ad6275a4a9b'::uuid;
  owns boolean; v_join date; v_duration text; v_months int; v_status text; v_reason text;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_signed_in'); END IF;
  SELECT * INTO app FROM job_applications WHERE id = p_application_id;
  IF app.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  owns := is_admin
    OR (app.company_post_id IS NOT NULL AND EXISTS (SELECT 1 FROM company_posts cp WHERE cp.id = app.company_post_id AND cp.manager_id = uid))
    OR (app.job_posting_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM job_postings jp WHERE jp.id = app.job_posting_id AND (
        jp.manager_id = uid OR (jp.manager_id IS NULL AND lower(trim(jp.company_name)) =
          lower(trim((SELECT mp.company_name FROM manager_profiles mp WHERE mp.user_id = uid)))))));
  IF NOT owns THEN RETURN jsonb_build_object('ok', false, 'error', 'not_authorised'); END IF;
  IF app.outcome = 'placed' THEN RETURN jsonb_build_object('ok', false, 'error', 'already_placed'); END IF;

  IF p_action = 'shortlist' THEN
    UPDATE job_applications SET outcome = 'shortlisted' WHERE id = app.id;
    INSERT INTO notifications (crew_id, kind, title, body, icon, screen) VALUES
      (app.crew_id, 'application_update', '⭐ You have been shortlisted!',
       coalesce(app.company_name,'A company') || ' shortlisted you for ' || coalesce(app.rank_applied,'a position') || '. Keep your documents ready.', '⭐', 'home');
  ELSIF p_action = 'offer' THEN
    SELECT cp.availability_status INTO v_status FROM crew_profiles cp WHERE cp.id = app.crew_id;
    IF v_status = 'joined' THEN RETURN jsonb_build_object('ok', false, 'error', 'crew_already_placed'); END IF;
    v_join := coalesce(p_joining_date, nullif(p_offer->>'joining_date','')::date);
    IF app.job_posting_id IS NOT NULL THEN
      SELECT jp.contract_duration INTO v_duration FROM job_postings jp WHERE jp.id = app.job_posting_id; END IF;
    IF v_duration IS NULL AND app.vacancy_id IS NOT NULL THEN
      SELECT ev.contract_duration INTO v_duration FROM external_vacancies ev WHERE ev.id = app.vacancy_id; END IF;
    v_months := nullif(substring(coalesce(v_duration,'') from '(\d+)'), '')::int;
    IF v_months IS NULL OR v_months < 1 THEN v_months := greatest(coalesce(nullif(p_contract_months, 9), 9), 1); END IF;
    UPDATE job_applications SET outcome = 'offered', offered_at = now(), offered_joining_date = v_join,
      offer_details = coalesce(p_offer, offer_details),
      manager_note = coalesce(nullif(p_offer->>'message',''), manager_note),
      placement_end = coalesce(v_join, current_date) + (v_months * interval '1 month')
      WHERE id = app.id;
  ELSIF p_action = 'decline' THEN
    v_reason := left(nullif(trim(coalesce(p_offer->>'reason','')), ''), 300);
    UPDATE job_applications SET outcome = 'declined', decline_reason = v_reason WHERE id = app.id;
    INSERT INTO notifications (crew_id, kind, title, body, icon, screen) VALUES
      (app.crew_id, 'application_update', 'Application not selected',
       coalesce(app.company_name,'The company') || ' did not select you for ' || coalesce(app.rank_applied,'this position')
       || coalesce('. Reason: ' || v_reason, '') || '. You can update your profile and reapply anytime.', '📝', 'jobs');
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'bad_action');
  END IF;
  RETURN jsonb_build_object('ok', true, 'outcome', (SELECT outcome FROM job_applications WHERE id = app.id));
END $function$;

-- Placement happens only when the SEA is signed
CREATE OR REPLACE FUNCTION public.place_on_sea_signed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE app job_applications%ROWTYPE; v_end date;
BEGIN
  IF NEW.status <> 'signed' OR OLD.status = 'signed' THEN RETURN NEW; END IF;
  SELECT * INTO app FROM job_applications WHERE id = NEW.application_id;
  IF app.id IS NULL THEN RETURN NEW; END IF;
  v_end := (coalesce(NEW.start_date, app.offered_joining_date, current_date)
            + (NEW.duration_months * interval '1 month'))::date;
  UPDATE job_applications SET outcome = 'placed', placement_end = v_end,
    crew_accepted_at = coalesce(crew_accepted_at, now()) WHERE id = app.id;
  UPDATE crew_profiles SET is_available = false, placed_company = app.company_name,
    placed_until = v_end, availability_status = 'joined' WHERE id = app.crew_id;
  INSERT INTO crew_availability (crew_profile_id, visible_to_employers) VALUES (app.crew_id, false)
    ON CONFLICT (crew_profile_id) DO UPDATE SET visible_to_employers = false, updated_at = now();
  UPDATE crew_profiles SET is_available = false, placed_until = v_end WHERE id = app.crew_id;
  UPDATE job_applications SET outcome = 'withdrawn'
   WHERE crew_id = app.crew_id AND id <> app.id AND outcome IN ('awaiting','shortlisted','offered','accepted');
  INSERT INTO notifications (crew_id, kind, title, body, icon, screen) VALUES
    (app.crew_id, 'placement', '⚓ Contract signed — you are onboard!',
     'Your SEA with ' || coalesce(app.company_name,'the company') || ' is signed. Your other open applications were closed. Fair winds!', '⚓', 'home');
  INSERT INTO app_events (event_type, message, severity, metadata) VALUES
    ('placement', 'Crew placed on SEA signing', 'info', jsonb_build_object('application_id', app.id));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_place_on_sea_signed ON public.sea_contracts;
CREATE TRIGGER trg_place_on_sea_signed AFTER UPDATE ON public.sea_contracts
  FOR EACH ROW EXECUTE FUNCTION public.place_on_sea_signed();

-- Crew Desk shows accepted (Processing) crew
CREATE OR REPLACE FUNCTION public.crew_desk_roster()
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'application_id', ja.id, 'outcome', ja.outcome,
    'crew_name', trim(coalesce(cp.first_name,'')||' '||coalesce(cp.last_name,'')),
    'rank', coalesce(cp.role, ja.rank_applied), 'nationality', cp.nationality,
    'vessel', ja.vessel_type, 'joining_date', ja.offered_joining_date,
    'placement_end', ja.placement_end,
    'crew_confirmed', ja.crew_accepted_at IS NOT NULL OR ja.outcome = 'placed',
    'crew_remark', ja.crew_remark,
    'crew_unique_id', cp.crew_unique_id
  ) ORDER BY ja.created_at DESC), '[]'::jsonb)
  FROM job_applications ja JOIN crew_profiles cp ON cp.id = ja.crew_id
  WHERE ja.outcome IN ('shortlisted','offered','accepted','placed') AND public._crew_desk_app_owned(ja.id);
$function$;

CREATE OR REPLACE FUNCTION public.crew_desk_certificate_radar()
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'application_id', ja.id,
    'crew_name', trim(coalesce(cp.first_name,'')||' '||coalesce(cp.last_name,'')),
    'rank', coalesce(cp.role, ja.rank_applied),
    'vessel', coalesce((SELECT sc.vessel_name FROM sea_contracts sc WHERE sc.application_id = ja.id AND sc.status IN ('issued','signed') ORDER BY sc.created_at DESC LIMIT 1), ja.vessel_type),
    'contract_start', (SELECT sc.start_date FROM sea_contracts sc WHERE sc.application_id = ja.id AND sc.status IN ('issued','signed') ORDER BY sc.created_at DESC LIMIT 1),
    'contract_months', (SELECT sc.duration_months FROM sea_contracts sc WHERE sc.application_id = ja.id AND sc.status IN ('issued','signed') ORDER BY sc.created_at DESC LIMIT 1),
    'certs', CASE WHEN jsonb_typeof(d.certificates)='array' THEN (
       SELECT coalesce(jsonb_agg(jsonb_build_object(
         'name', coalesce(e->>'name', e->>'certificateName', e->>'title', 'Certificate'),
         'number', coalesce(e->>'number', e->>'certificateNumber', e->>'certNumber', ''),
         'expiry', coalesce(e->>'expiryDate', e->>'expiry_date', e->>'expiry', ''))), '[]'::jsonb)
       FROM jsonb_array_elements(d.certificates) e WHERE jsonb_typeof(e)='object') ELSE '[]'::jsonb END
  ) ORDER BY cp.last_name), '[]'::jsonb)
  FROM job_applications ja JOIN crew_profiles cp ON cp.id = ja.crew_id
  LEFT JOIN crew_cv_data d ON d.user_id = cp.id
  WHERE ja.outcome IN ('offered','accepted','placed') AND (ja.crew_accepted_at IS NOT NULL OR ja.outcome = 'placed')
    AND public._crew_desk_app_owned(ja.id);
$function$;

CREATE OR REPLACE FUNCTION public.get_my_applications()
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT COALESCE(jsonb_agg(x ORDER BY x.created_at DESC), '[]'::jsonb)
  FROM (
    SELECT ja.id, ja.company_name, ja.rank_applied, ja.vessel_type, ja.outcome, ja.created_at,
      ja.created_at AS applied_at, ja.offer_details, ja.job_posting_id, ja.vacancy_id,
      ja.decline_reason, ja.crew_remark, ja.reapplied_at,
      CASE WHEN ja.job_posting_id IS NOT NULL
        THEN NULLIF(TRIM(COALESCE(jp.rank_required, '') || ' — ' || COALESCE(jp.vessel_type, '')), '—')
        ELSE NULL END AS vacancy_label
    FROM public.job_applications ja
    LEFT JOIN public.job_postings jp ON jp.id = ja.job_posting_id
    WHERE ja.crew_id = auth.uid()
  ) x;
$function$;

NOTIFY pgrst, 'reload schema';