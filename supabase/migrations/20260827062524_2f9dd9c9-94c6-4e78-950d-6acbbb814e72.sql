CREATE OR REPLACE FUNCTION public.generate_crew_unique_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_id text;
  year_part text := EXTRACT(YEAR FROM NOW())::text;
  seq_num int;
BEGIN
  IF NEW.crew_unique_id IS NOT NULL THEN RETURN NEW; END IF;
  SELECT coalesce(max(substring(crew_unique_id from 'SM-\d{4}-(\d+)')::int), 0) + 1
    INTO seq_num
    FROM public.crew_profiles
   WHERE crew_unique_id LIKE 'SM-' || year_part || '-%';
  LOOP
    new_id := 'SM-' || year_part || '-' || LPAD(seq_num::text, 5, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.crew_profiles WHERE crew_unique_id = new_id);
    seq_num := seq_num + 1;
  END LOOP;
  NEW.crew_unique_id := new_id;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.get_my_offers()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT coalesce(jsonb_agg(to_jsonb(t) - 'offered_sort' ORDER BY t.offered_sort DESC NULLS LAST), '[]'::jsonb)
  FROM (
    SELECT ja.id,
           ja.id AS application_id,
           ja.company_name,
           ja.rank_applied,
           ja.vessel_type,
           ja.outcome,
           ja.created_at AS applied_at,
           ja.offered_at,
           ja.offered_joining_date,
           ja.offer_details,
           coalesce((ja.offer_details->>'offered_at'), ja.offered_at::text) AS offered_sort
    FROM job_applications ja
    WHERE ja.crew_id = auth.uid()
      AND ja.offer_details IS NOT NULL
      AND ja.outcome = 'offered'
  ) t;
$function$;

GRANT EXECUTE ON FUNCTION public.get_my_offers() TO authenticated;

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
  v_duration text;
  v_months int;
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

    -- real contract length from the linked posting, e.g. "4 months +/- 1" -> 4
    IF app.job_posting_id IS NOT NULL THEN
      SELECT jp.contract_duration INTO v_duration FROM job_postings jp WHERE jp.id = app.job_posting_id;
    END IF;
    IF v_duration IS NULL AND app.vacancy_id IS NOT NULL THEN
      SELECT ev.contract_duration INTO v_duration FROM external_vacancies ev WHERE ev.id = app.vacancy_id;
    END IF;
    v_months := nullif(substring(coalesce(v_duration,'') from '(\d+)'), '')::int;
    IF v_months IS NULL OR v_months < 1 THEN
      v_months := greatest(coalesce(nullif(p_contract_months, 9), 9), 1);
    END IF;

    UPDATE job_applications SET outcome = 'offered', offered_at = now(),
      offered_joining_date = v_join,
      offer_details = coalesce(p_offer, offer_details),
      manager_note = coalesce(nullif(p_offer->>'message',''), manager_note),
      placement_end = coalesce(v_join, current_date) + (v_months * interval '1 month')
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