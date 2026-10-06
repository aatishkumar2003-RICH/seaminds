CREATE OR REPLACE FUNCTION public.process_answer_scoring_queue() RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_secret text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM answer_scoring_jobs WHERE status IN ('pending','running') AND next_attempt_at <= now() AND attempts < max_attempts) THEN
    RETURN 'idle';
  END IF;
  SELECT value INTO v_secret FROM admin_settings WHERE key = 'scoring_worker_secret';
  PERFORM net.http_post(
    url := 'https://luomzexqgcjtcmdlbevo.supabase.co/functions/v1/score-paper-answers',
    headers := jsonb_build_object('Content-Type','application/json','x-worker-secret', coalesce(v_secret,''),
      'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1b216ZXhxZ2NqdGNtZGxiZXZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0OTY4NjEsImV4cCI6MjA4NzA3Mjg2MX0.QJoLu7WC-9h4qoTEXfOMPu1OJTmu8hzBuOGLPOq1IuY'),
    body := '{}'::jsonb, timeout_milliseconds := 55000);
  RETURN 'kicked';
END $$;
REVOKE ALL ON FUNCTION public.process_answer_scoring_queue() FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.process_scoring_jobs()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE j record; n_done int := 0; n_sent int := 0; n_dead int := 0; v_secret text;
BEGIN
  SELECT value INTO v_secret FROM admin_settings WHERE key = 'scoring_worker_secret';

  UPDATE scoring_jobs sj SET status='done', completed_at = now()
  FROM smc_assessments a
  WHERE sj.assessment_id = a.id AND sj.status IN ('pending','sent')
    AND a.status = 'completed' AND a.overall_score IS NOT NULL;
  GET DIAGNOSTICS n_done = ROW_COUNT;

  WITH dead AS (
    UPDATE scoring_jobs SET status='failed'
    WHERE status IN ('pending','sent') AND attempts >= 5 AND next_attempt_at <= now()
    RETURNING assessment_id, attempts, last_error)
  INSERT INTO app_events (event_type, message, severity, metadata)
  SELECT 'scoring_dead_letter', 'Assessment scoring failed after retries — manual review needed', 'error',
         jsonb_build_object('assessment_id', assessment_id, 'attempts', attempts, 'last_error', last_error)
  FROM dead;
  GET DIAGNOSTICS n_dead = ROW_COUNT;

  FOR j IN SELECT * FROM scoring_jobs
    WHERE status IN ('pending','sent') AND attempts < 5 AND next_attempt_at <= now()
    ORDER BY created_at LIMIT 3
  LOOP
    PERFORM net.http_post(
      url := 'https://luomzexqgcjtcmdlbevo.supabase.co/functions/v1/score-assessment',
      headers := jsonb_build_object('Content-Type','application/json',
        'x-worker-secret', coalesce(v_secret,''),
        'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1b216ZXhxZ2NqdGNtZGxiZXZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0OTY4NjEsImV4cCI6MjA4NzA3Mjg2MX0.QJoLu7WC-9h4qoTEXfOMPu1OJTmu8hzBuOGLPOq1IuY',
        'Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1b216ZXhxZ2NqdGNtZGxiZXZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0OTY4NjEsImV4cCI6MjA4NzA3Mjg2MX0.QJoLu7WC-9h4qoTEXfOMPu1OJTmu8hzBuOGLPOq1IuY'),
      body := j.payload, timeout_milliseconds := 55000);
    UPDATE scoring_jobs SET status='sent', attempts = attempts + 1,
      next_attempt_at = now() + (power(2, attempts + 1)::int * interval '1 minute')
      WHERE id = j.id;
    n_sent := n_sent + 1;
  END LOOP;
  PERFORM public.process_answer_scoring_queue(); -- R3: backstop for per-answer scoring retries (client kicks immediately)
  RETURN format('queue: healed=%s sent=%s dead=%s', n_done, n_sent, n_dead);
END $function$;