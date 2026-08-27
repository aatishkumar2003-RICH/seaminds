-- (d) duplicate unique constraint cleanup
ALTER TABLE public.crew_availability DROP CONSTRAINT IF EXISTS crew_availability_profile_unique;

-- (a) get_my_offers
CREATE OR REPLACE FUNCTION public.get_my_offers()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT coalesce(jsonb_agg(t ORDER BY t.offered_sort DESC NULLS LAST), '[]'::jsonb)
  FROM (
    SELECT ja.id AS application_id,
           ja.company_name,
           ja.rank_applied,
           ja.vessel_type,
           ja.outcome,
           ja.created_at AS applied_at,
           ja.offered_at,
           ja.offered_joining_date,
           ja.offer_details,
           (ja.offer_details->>'offered_at') AS offered_sort
    FROM job_applications ja
    WHERE ja.crew_id = auth.uid()
      AND ja.offer_details IS NOT NULL
  ) t;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_offers() TO authenticated;

-- (b) availability sync
CREATE OR REPLACE FUNCTION public.sync_availability_to_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE crew_profiles
     SET is_available = NEW.visible_to_employers,
         available_from = NEW.availability_date
   WHERE id = NEW.crew_profile_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_availability ON public.crew_availability;
CREATE TRIGGER trg_sync_availability
AFTER INSERT OR UPDATE ON public.crew_availability
FOR EACH ROW EXECUTE FUNCTION public.sync_availability_to_profile();

-- (c) placement privacy + real contract length
CREATE OR REPLACE FUNCTION public.crew_respond_offer(p_application_id uuid, p_accept boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  app job_applications%ROWTYPE;
  v_duration text;
  v_months int;
  v_join date;
  v_end date;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_signed_in'); END IF;
  SELECT * INTO app FROM job_applications WHERE id = p_application_id AND crew_id = uid;
  IF app.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  IF app.outcome <> 'offered' THEN RETURN jsonb_build_object('ok', false, 'error', 'not_offered'); END IF;

  IF p_accept THEN
    IF app.job_posting_id IS NOT NULL THEN
      SELECT jp.contract_duration INTO v_duration FROM job_postings jp WHERE jp.id = app.job_posting_id;
    END IF;
    IF v_duration IS NULL AND app.vacancy_id IS NOT NULL THEN
      SELECT ev.contract_duration INTO v_duration FROM external_vacancies ev WHERE ev.id = app.vacancy_id;
    END IF;

    v_months := nullif((regexp_match(coalesce(v_duration,''), '(\d+)'))[1], '')::int;
    IF v_months IS NULL OR v_months < 1 THEN v_months := 9; END IF;

    v_join := coalesce(
      nullif(app.offer_details->>'joining_date','')::date,
      app.offered_joining_date,
      current_date);
    v_end := (v_join + (v_months * interval '1 month'))::date;

    UPDATE job_applications
       SET outcome = 'placed', crew_accepted_at = now(), placement_end = v_end
     WHERE id = app.id;

    UPDATE crew_profiles
       SET is_available = false,
           placed_company = app.company_name,
           placed_until = v_end
     WHERE id = uid;

    INSERT INTO crew_availability (crew_profile_id, visible_to_employers)
    VALUES (uid, false)
    ON CONFLICT (crew_profile_id) DO UPDATE SET visible_to_employers = false, updated_at = now();

    -- re-assert placement lock (availability trigger may reset it)
    UPDATE crew_profiles SET is_available = false, placed_until = v_end WHERE id = uid;

    INSERT INTO notifications (crew_id, kind, title, body, icon, screen) VALUES
      (uid, 'placement', '🎉 Congratulations — you are placed!',
       'Your placement with ' || coalesce(app.company_name,'the company') ||
       ' is confirmed. Your CV is now hidden from other companies until your contract ends. Fair winds, sailor!',
       '⚓', 'home');
    INSERT INTO app_events (event_type, message, severity, metadata) VALUES
      ('placement', 'Crew placed via SeaMinds', 'info',
       jsonb_build_object('application_id', app.id, 'company', app.company_name, 'rank', app.rank_applied));
  ELSE
    UPDATE job_applications SET outcome = 'offer_declined' WHERE id = app.id;
  END IF;
  RETURN jsonb_build_object('ok', true, 'placed', p_accept);
END $function$;

-- (2a) remove offer notification insert from manager_update_application
CREATE OR REPLACE FUNCTION public.manager_update_application(p_application_id uuid, p_action text, p_joining_date date DEFAULT NULL::date, p_contract_months integer DEFAULT 9, p_offer jsonb DEFAULT NULL::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  app job_applications%ROWTYPE;
  is_admin boolean := uid = '492ee966-e015-4440-a415-6ad6275a4a9b'::uuid;
  owns boolean;
  v_join date;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_signed_in'); END IF;
  SELECT * INTO app FROM job_applications WHERE id = p_application_id;
  IF app.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  owns := is_admin
    OR (app.company_post_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM company_posts cp WHERE cp.id = app.company_post_id AND cp.manager_id = uid))
    OR (app.job_posting_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM job_postings jp
      WHERE jp.id = app.job_posting_id
        AND (
          jp.manager_id = uid
          OR (jp.manager_id IS NULL AND lower(trim(jp.company_name)) =
              lower(trim((SELECT mp.company_name FROM manager_profiles mp WHERE mp.user_id = uid))))
        )));
  IF NOT owns THEN RETURN jsonb_build_object('ok', false, 'error', 'not_authorised'); END IF;
  IF app.outcome = 'placed' THEN RETURN jsonb_build_object('ok', false, 'error', 'already_placed'); END IF;

  IF p_action = 'shortlist' THEN
    UPDATE job_applications SET outcome = 'shortlisted' WHERE id = app.id;
    INSERT INTO notifications (crew_id, kind, title, body, icon, screen) VALUES
      (app.crew_id, 'application_update', '⭐ You have been shortlisted!',
       coalesce(app.company_name,'A company') || ' shortlisted you for ' || coalesce(app.rank_applied,'a position') || '. Keep your documents ready.',
       '⭐', 'home');
  ELSIF p_action = 'offer' THEN
    v_join := coalesce(p_joining_date, nullif(p_offer->>'joining_date','')::date);
    UPDATE job_applications SET outcome = 'offered', offered_at = now(),
      offered_joining_date = v_join,
      offer_details = coalesce(p_offer, offer_details),
      manager_note = coalesce(nullif(p_offer->>'message',''), manager_note),
      placement_end = coalesce(v_join, current_date) + (greatest(coalesce(p_contract_months,9),1) * interval '1 month')::interval
      WHERE id = app.id;
    -- offer notifications are created solely by the notify-application edge function
  ELSIF p_action = 'decline' THEN
    UPDATE job_applications SET outcome = 'declined' WHERE id = app.id;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'bad_action');
  END IF;
  RETURN jsonb_build_object('ok', true, 'outcome',
    (SELECT outcome FROM job_applications WHERE id = app.id));
END $function$;

NOTIFY pgrst,'reload schema';