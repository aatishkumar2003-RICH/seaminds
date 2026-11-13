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
  HAVING bool_and(t.status = 'completed') AND max(t.completed_at) > now() - interval '3 days'
     AND (s.thanked_at IS NULL OR max(t.completed_at) > s.thanked_at)
  LIMIT p_limit $$;
REVOKE ALL ON FUNCTION public.assignment_reminders_due(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assignment_reminders_due(int) TO service_role;