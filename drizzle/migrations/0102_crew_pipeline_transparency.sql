ALTER TABLE public.crew_profiles ADD COLUMN IF NOT EXISTS inquiries_paused boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.get_my_engagements()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'paused', COALESCE((SELECT inquiries_paused FROM crew_profiles WHERE id = auth.uid()), false),
    'items', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', a.id, 'company_name', a.company_name, 'rank', a.rank_applied, 'vessel_type', a.vessel_type, 'outcome', a.outcome, 'viewed', a.viewed_at IS NOT NULL) ORDER BY a.created_at DESC)
      FROM job_applications a WHERE a.crew_id = auth.uid() AND a.outcome IN ('awaiting','shortlisted','offered','accepted')), '[]'::jsonb));
$$;

CREATE OR REPLACE FUNCTION public.crew_disengage(p_application_id uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_reason text := left(coalesce(p_reason,''), 60);
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  IF v_reason NOT IN ('berth_accepted','wage_mismatch','joining_date','personal_leave','other') THEN v_reason := 'other'; END IF;
  UPDATE job_applications SET outcome = 'withdrawn', crew_remark = 'Disengaged: ' || replace(v_reason,'_',' '), crew_remark_at = now()
   WHERE id = p_application_id AND crew_id = auth.uid() AND outcome IN ('awaiting','shortlisted','offered','accepted');
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Not found or already closed'); END IF;
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.set_inquiries_paused(p_paused boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  UPDATE crew_profiles SET inquiries_paused = coalesce(p_paused,false) WHERE id = auth.uid();
  RETURN jsonb_build_object('ok', true, 'paused', coalesce(p_paused,false));
END $$;

CREATE OR REPLACE FUNCTION public.auto_disengage_on_placement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.outcome = 'placed' AND OLD.outcome IS DISTINCT FROM 'placed' THEN
    UPDATE job_applications SET outcome = 'withdrawn', crew_remark = 'Berth confirmed elsewhere', crew_remark_at = now()
     WHERE crew_id = NEW.crew_id AND id <> NEW.id AND outcome IN ('awaiting','shortlisted','offered','accepted');
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_auto_disengage_on_placement ON public.job_applications;
CREATE TRIGGER trg_auto_disengage_on_placement AFTER UPDATE OF outcome ON public.job_applications
  FOR EACH ROW EXECUTE FUNCTION public.auto_disengage_on_placement();

REVOKE ALL ON FUNCTION public.get_my_engagements(), public.crew_disengage(uuid,text), public.set_inquiries_paused(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_engagements(), public.crew_disengage(uuid,text), public.set_inquiries_paused(boolean) TO authenticated;
NOTIFY pgrst, 'reload schema';