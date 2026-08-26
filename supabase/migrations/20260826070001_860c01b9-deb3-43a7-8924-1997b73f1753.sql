ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS offer_details jsonb;

DROP FUNCTION IF EXISTS public.manager_update_application(uuid, text, date, integer);

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
    INSERT INTO notifications (crew_id, kind, title, body, icon, screen) VALUES
      (app.crew_id, 'job_offer', '🎉 JOB OFFER — ' || coalesce(app.rank_applied,'position'),
       coalesce(app.company_name,'A company') || ' wants you on board' ||
       coalesce(', joining ' || to_char(v_join,'DD Mon YYYY'), '') ||
       '. Open SeaMinds to accept.', '🎉', 'home');
  ELSIF p_action = 'decline' THEN
    UPDATE job_applications SET outcome = 'declined' WHERE id = app.id;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'bad_action');
  END IF;
  RETURN jsonb_build_object('ok', true, 'outcome',
    (SELECT outcome FROM job_applications WHERE id = app.id));
END $function$;

NOTIFY pgrst, 'reload schema';