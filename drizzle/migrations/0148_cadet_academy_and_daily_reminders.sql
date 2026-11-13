CREATE TABLE public.cadet_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL,
  crew_id uuid,
  email text NOT NULL,
  name text,
  track text NOT NULL DEFAULT 'deck' CHECK (track IN ('deck','engine')),
  vessel text, imo text,
  shore_start date NOT NULL DEFAULT current_date,
  join_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','withdrawn')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (manager_id, email)
);
GRANT SELECT ON public.cadet_enrollments TO authenticated;
GRANT ALL ON public.cadet_enrollments TO service_role;
ALTER TABLE public.cadet_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY cadet_enr_read ON public.cadet_enrollments FOR SELECT TO authenticated USING (manager_id = auth.uid() OR crew_id = auth.uid());

CREATE TABLE public.cadet_week_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.cadet_enrollments(id) ON DELETE CASCADE,
  week int NOT NULL CHECK (week BETWEEN 1 AND 32),
  correct int NOT NULL, total int NOT NULL, score int NOT NULL,
  checklist jsonb NOT NULL DEFAULT '[]', officer_name text,
  attempts int NOT NULL DEFAULT 1,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (enrollment_id, week)
);
GRANT SELECT ON public.cadet_week_results TO authenticated;
GRANT ALL ON public.cadet_week_results TO service_role;
ALTER TABLE public.cadet_week_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY cadet_res_read ON public.cadet_week_results FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.cadet_enrollments e WHERE e.id = enrollment_id AND (e.manager_id = auth.uid() OR e.crew_id = auth.uid())));

CREATE TABLE public.assignment_reminder_state (
  crew_id uuid PRIMARY KEY,
  last_reminder_at timestamptz, reminder_count int NOT NULL DEFAULT 0,
  thanked_at timestamptz
);
GRANT ALL ON public.assignment_reminder_state TO service_role;
ALTER TABLE public.assignment_reminder_state ENABLE ROW LEVEL SECURITY;

-- Curriculum text lives in src/lib/cadetCurriculum.ts; answer keys only here.
CREATE OR REPLACE FUNCTION public._cadet_key() RETURNS jsonb LANGUAGE sql IMMUTABLE AS $fn$ SELECT '{"deck":[[2,1,0],[3,2,1],[0,3,1],[1,3,3],[2,1],[3,2],[3,3],[1,0],[2,1],[3,2],[0,3],[1,0],[2,1],[3,2],[0,3],[1,0],[2,1],[3,2],[3,3],[1,3],[1,1],[3,2],[0,2],[1,0],[2,1],[3,1],[0,2],[1,0],[1,1],[3,2],[0,3],[1,0]],"engine":[[1,0,3],[2,1,0],[3,2,1],[0,2,2],[1,0],[2,1],[3,2],[0,3],[1,3],[2,1],[3,2],[3,2],[1,0],[2,1],[3,2],[0,3],[1,0],[2,1],[3,2],[0,3],[1,0],[1,0],[3,2],[0,3],[0,0],[1,1],[2,2],[0,3],[1,0],[2,1],[3,2],[0,3]]}'::jsonb $fn$;
REVOKE ALL ON FUNCTION public._cadet_key() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._cadet_week_due(e public.cadet_enrollments, w int) RETURNS date LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN w <= 4 THEN e.shore_start + (w-1)*7 + 6
              ELSE coalesce(e.join_date, e.shore_start + 35) + (w-5)*7 + 6 END $$;

CREATE OR REPLACE FUNCTION public._cadet_current_week(e public.cadet_enrollments) RETURNS int LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT least(32, greatest(
    coalesce((SELECT max(week) FROM cadet_week_results r WHERE r.enrollment_id = e.id), 0) + 1,
    coalesce((SELECT max(w) FROM generate_series(1,32) w WHERE public._cadet_week_due(e, w) - 6 <= current_date), 1))) $$;

CREATE OR REPLACE FUNCTION public.manager_enroll_cadet(p_email text, p_name text, p_track text, p_vessel text DEFAULT NULL, p_imo text DEFAULT NULL, p_shore_start date DEFAULT NULL, p_join_date date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email text := lower(trim(p_email)); v_crew uuid; v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM manager_profiles WHERE user_id = auth.uid()) THEN RETURN jsonb_build_object('ok',false,'error','NOT_MANAGER'); END IF;
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RETURN jsonb_build_object('ok',false,'error','BAD_EMAIL'); END IF;
  IF p_track NOT IN ('deck','engine') THEN RETURN jsonb_build_object('ok',false,'error','BAD_TRACK'); END IF;
  SELECT id INTO v_crew FROM crew_profiles WHERE lower(email) = v_email LIMIT 1;
  INSERT INTO cadet_enrollments (manager_id, crew_id, email, name, track, vessel, imo, shore_start, join_date)
  VALUES (auth.uid(), v_crew, v_email, nullif(trim(p_name),''), p_track, nullif(trim(p_vessel),''),
          CASE WHEN p_imo ~ '^\d{7}$' THEN p_imo END, coalesce(p_shore_start, current_date), p_join_date)
  ON CONFLICT (manager_id, email) DO UPDATE SET name = coalesce(EXCLUDED.name, cadet_enrollments.name), track = EXCLUDED.track,
    vessel = coalesce(EXCLUDED.vessel, cadet_enrollments.vessel), imo = coalesce(EXCLUDED.imo, cadet_enrollments.imo),
    shore_start = EXCLUDED.shore_start, join_date = coalesce(EXCLUDED.join_date, cadet_enrollments.join_date),
    crew_id = coalesce(cadet_enrollments.crew_id, EXCLUDED.crew_id), status = 'active'
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok',true,'id',v_id,'registered',v_crew IS NOT NULL);
END $$;

CREATE OR REPLACE FUNCTION public.manager_update_cadet(p_id uuid, p_vessel text, p_imo text, p_join_date date, p_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_status NOT IN ('active','completed','withdrawn') THEN RETURN jsonb_build_object('ok',false,'error','BAD_STATUS'); END IF;
  UPDATE cadet_enrollments SET vessel = nullif(trim(p_vessel),''), imo = CASE WHEN p_imo ~ '^\d{7}$' THEN p_imo END,
    join_date = p_join_date, status = p_status WHERE id = p_id AND manager_id = auth.uid();
  RETURN jsonb_build_object('ok', FOUND);
END $$;

CREATE OR REPLACE FUNCTION public.manager_delete_cadet(p_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN DELETE FROM cadet_enrollments WHERE id = p_id AND manager_id = auth.uid(); RETURN jsonb_build_object('ok', FOUND); END $$;

CREATE OR REPLACE FUNCTION public.manager_cadet_roster() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(x ORDER BY x->>'status', (x->>'overdue_days')::int DESC, x->>'name'), '[]'::jsonb) FROM (
    SELECT jsonb_build_object('id', e.id, 'email', e.email, 'track', e.track, 'vessel', e.vessel, 'imo', e.imo,
      'name', coalesce(nullif(trim(concat_ws(' ', cp.first_name, cp.last_name)),''), e.name, split_part(e.email,'@',1)),
      'registered', e.crew_id IS NOT NULL, 'status', e.status, 'shore_start', e.shore_start, 'join_date', e.join_date,
      'current_week', public._cadet_current_week(e), 'done', (SELECT count(*) FROM cadet_week_results r WHERE r.enrollment_id = e.id),
      'avg_score', (SELECT round(avg(score)) FROM cadet_week_results r WHERE r.enrollment_id = e.id),
      'low_weeks', (SELECT count(*) FROM cadet_week_results r WHERE r.enrollment_id = e.id AND r.score < 60),
      'last_activity', (SELECT max(completed_at) FROM cadet_week_results r WHERE r.enrollment_id = e.id),
      'overdue_days', greatest(0, current_date - public._cadet_week_due(e, least(32, coalesce((SELECT max(week) FROM cadet_week_results r WHERE r.enrollment_id = e.id),0)+1)))
    ) x
    FROM cadet_enrollments e LEFT JOIN crew_profiles cp ON cp.id = e.crew_id
    WHERE e.manager_id = auth.uid()) s $$;

CREATE OR REPLACE FUNCTION public.manager_cadet_dossier(p_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE e cadet_enrollments;
BEGIN
  SELECT * INTO e FROM cadet_enrollments WHERE id = p_id AND manager_id = auth.uid();
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','NOT_FOUND'); END IF;
  RETURN jsonb_build_object('ok',true,
    'cadet', (SELECT to_jsonb(e) || jsonb_build_object('display_name', coalesce(nullif(trim(concat_ws(' ', cp.first_name, cp.last_name)),''), e.name, e.email),
              'company', (SELECT company_name FROM manager_profiles WHERE user_id = e.manager_id LIMIT 1), 'current_week', public._cadet_current_week(e))
              FROM (SELECT 1) one LEFT JOIN crew_profiles cp ON cp.id = e.crew_id),
    'weeks', (SELECT jsonb_agg(jsonb_build_object('week', w, 'due', public._cadet_week_due(e, w),
               'result', (SELECT to_jsonb(r) - 'enrollment_id' FROM cadet_week_results r WHERE r.enrollment_id = e.id AND r.week = w)) ORDER BY w)
              FROM generate_series(1,32) w));
END $$;

CREATE OR REPLACE FUNCTION public.cadet_my_program() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email text := lower(coalesce(auth.jwt()->>'email','')); e cadet_enrollments;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok',false,'error','AUTH'); END IF;
  IF v_email <> '' THEN UPDATE cadet_enrollments SET crew_id = auth.uid() WHERE crew_id IS NULL AND email = v_email; END IF;
  SELECT * INTO e FROM cadet_enrollments WHERE crew_id = auth.uid() AND status <> 'withdrawn' ORDER BY (status='active') DESC, created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',true,'enrolled',false); END IF;
  RETURN jsonb_build_object('ok',true,'enrolled',true,
    'enrollment', to_jsonb(e) || jsonb_build_object('company', (SELECT company_name FROM manager_profiles WHERE user_id = e.manager_id LIMIT 1), 'current_week', public._cadet_current_week(e)),
    'dues', (SELECT jsonb_agg(public._cadet_week_due(e, w) ORDER BY w) FROM generate_series(1,32) w),
    'results', coalesce((SELECT jsonb_agg(to_jsonb(r) - 'enrollment_id' ORDER BY week) FROM cadet_week_results r WHERE r.enrollment_id = e.id), '[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION public.cadet_submit_week(p_week int, p_answers int[], p_checklist boolean[], p_officer text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e cadet_enrollments; wk jsonb; v_total int; v_correct int := 0; i int; v_score int; v_unlocked int;
BEGIN
  SELECT * INTO e FROM cadet_enrollments WHERE crew_id = auth.uid() AND status = 'active' ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','NOT_ENROLLED'); END IF;
  v_unlocked := public._cadet_current_week(e);
  IF p_week < 1 OR p_week > v_unlocked THEN RETURN jsonb_build_object('ok',false,'error','LOCKED'); END IF;
  wk := public._cadet_key() -> e.track -> (p_week - 1);
  v_total := jsonb_array_length(wk);
  IF coalesce(array_length(p_answers,1),0) <> v_total THEN RETURN jsonb_build_object('ok',false,'error','ANSWER_ALL'); END IF;
  FOR i IN 1..v_total LOOP IF p_answers[i] = (wk->>(i-1))::int THEN v_correct := v_correct + 1; END IF; END LOOP;
  v_score := round(100.0 * v_correct / v_total);
  INSERT INTO cadet_week_results (enrollment_id, week, correct, total, score, checklist, officer_name)
  VALUES (e.id, p_week, v_correct, v_total, v_score, to_jsonb(coalesce(p_checklist, '{}')), nullif(left(trim(p_officer),80),''))
  ON CONFLICT (enrollment_id, week) DO UPDATE SET correct = greatest(cadet_week_results.correct, EXCLUDED.correct),
    score = greatest(cadet_week_results.score, EXCLUDED.score), checklist = EXCLUDED.checklist,
    officer_name = coalesce(EXCLUDED.officer_name, cadet_week_results.officer_name), attempts = cadet_week_results.attempts + 1,
    completed_at = now();
  IF p_week = 32 THEN UPDATE cadet_enrollments SET status = 'completed' WHERE id = e.id; END IF;
  RETURN jsonb_build_object('ok',true,'correct',v_correct,'total',v_total,'score',v_score,'answers', wk);
END $$;

-- Daily pending-items reminders (no attempt cap) and one thank-you when everything is done.
CREATE OR REPLACE FUNCTION public.assignment_reminders_due(p_limit int DEFAULT 200)
RETURNS TABLE(kind text, crew_id uuid, email text, name text, company text, items jsonb) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH tr AS (
    SELECT a.crew_id, a.status, a.completed_at, m.title, a.token, mp.company_name
    FROM crew_training_assignments a JOIN training_modules m ON m.id = a.module_id
    LEFT JOIN manager_profiles mp ON mp.user_id = a.assigned_by
    WHERE a.source = 'manager'),
  cad AS (
    SELECT e.crew_id, w.cw, e.track, mp.company_name,
      EXISTS (SELECT 1 FROM cadet_week_results r WHERE r.enrollment_id = e.id AND r.week = w.cw) done_now
    FROM cadet_enrollments e CROSS JOIN LATERAL (SELECT public._cadet_current_week(e) cw) w
    LEFT JOIN manager_profiles mp ON mp.user_id = e.manager_id
    WHERE e.status = 'active' AND e.crew_id IS NOT NULL),
  pend AS (
    SELECT p.crew_id, max(p.company_name) company, jsonb_agg(jsonb_build_object('title', p.title, 'url', p.url)) items
    FROM (SELECT crew_id, company_name, title, 'https://seaminds.life/training/' || token url FROM tr WHERE status <> 'completed'
          UNION ALL
          SELECT crew_id, company_name, 'Cadet programme - Week ' || cw || ' (' || track || ')', 'https://seaminds.life/training?tab=cadet' FROM cad WHERE NOT done_now) p
    GROUP BY p.crew_id)
  SELECT 'pending'::text, p.crew_id, cp.email, nullif(trim(concat_ws(' ', cp.first_name, cp.last_name)),''), p.company, p.items
  FROM pend p JOIN crew_profiles cp ON cp.id = p.crew_id
  LEFT JOIN assignment_reminder_state s ON s.crew_id = p.crew_id
  WHERE cp.email IS NOT NULL AND (s.last_reminder_at IS NULL OR s.last_reminder_at < now() - interval '22 hours')
  UNION ALL
  SELECT 'thanks'::text, t.crew_id, cp.email, nullif(trim(concat_ws(' ', cp.first_name, cp.last_name)),''), max(t.company_name), '[]'::jsonb
  FROM tr t JOIN crew_profiles cp ON cp.id = t.crew_id
  LEFT JOIN assignment_reminder_state s ON s.crew_id = t.crew_id
  WHERE cp.email IS NOT NULL AND NOT EXISTS (SELECT 1 FROM cad WHERE cad.crew_id = t.crew_id AND NOT cad.done_now)
  GROUP BY t.crew_id, cp.email, cp.first_name, cp.last_name, s.thanked_at
  HAVING bool_and(t.status = 'completed') AND (s.thanked_at IS NULL OR max(t.completed_at) > s.thanked_at)
  LIMIT p_limit $$;
REVOKE ALL ON FUNCTION public.assignment_reminders_due(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assignment_reminders_due(int) TO service_role;

-- Interview reminders: daily until done (was max 3), 60-day safety stop.
CREATE OR REPLACE FUNCTION public.interview_followups_due(p_limit integer DEFAULT 200)
 RETURNS TABLE(kind text, invite_id uuid, token text, email text, crew_id uuid, name text, company text, rank text, language text, prep_tracks text[], score numeric, attempt integer, modules jsonb)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT 'reminder', i.id, i.token, i.invited_email, i.crew_profile_id, i.invited_name, c.company_name, c.rank_required, c.language, c.prep_tracks, NULL::numeric, i.reminder_count + 1, '[]'::jsonb
  FROM interview_invites i JOIN interview_campaigns c ON c.id = i.campaign_id
  WHERE c.status = 'open' AND i.status IN ('sent','opened','in_progress','claimed')
    AND i.reminder_count < 60 AND i.created_at < now() - interval '24 hours'
    AND coalesce(i.last_reminder_at, i.created_at) < now() - interval '22 hours'
    AND (i.invited_email IS NOT NULL OR i.crew_profile_id IS NOT NULL)
  UNION ALL
  SELECT 'improvement', i.id, i.token, i.invited_email, i.crew_profile_id, i.invited_name, c.company_name, c.rank_required, c.language, c.prep_tracks, i.overall_score, i.improvement_reminders + 1,
    coalesce((SELECT jsonb_agg(jsonb_build_object('title', m.title, 'token', a.token)) FROM crew_training_assignments a JOIN training_modules m ON m.id = a.module_id
              WHERE a.invite_id = i.id AND a.status <> 'completed'), '[]'::jsonb)
  FROM interview_invites i JOIN interview_campaigns c ON c.id = i.campaign_id
  WHERE i.improvement_status = 'pending' AND i.crew_profile_id IS NOT NULL AND i.improvement_reminders < 3
    AND (i.improvement_sent_at IS NULL OR i.improvement_sent_at < now() - interval '48 hours')
  LIMIT p_limit;
$function$;