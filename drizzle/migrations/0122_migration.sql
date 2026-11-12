ALTER TABLE public.interview_campaigns ADD COLUMN IF NOT EXISTS prep_tracks text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.interview_invites
  ADD COLUMN IF NOT EXISTS reminder_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reminder_at timestamptz,
  ADD COLUMN IF NOT EXISTS improvement_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS improvement_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS improvement_reminders integer NOT NULL DEFAULT 0;

-- Server decides follow-up when an interview completes: low score (<3.50) or manager prep tracks -> prescribe top 2 gap modules.
CREATE OR REPLACE FUNCTION public.interview_prescribe_on_complete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE c record; rec jsonb; item jsonb; m record; n int := 0;
BEGIN
  IF NEW.status <> 'completed' OR OLD.status = 'completed' OR NEW.crew_profile_id IS NULL THEN RETURN NEW; END IF;
  SELECT manager_id, vessel_type, prep_tracks INTO c FROM interview_campaigns WHERE id = NEW.campaign_id;
  IF coalesce(NEW.overall_score, 0) >= 3.5 AND cardinality(coalesce(c.prep_tracks,'{}')) = 0 THEN RETURN NEW; END IF;
  rec := training_recommend_core(NEW.crew_profile_id, NULL, c.vessel_type, 10);
  FOR item IN SELECT e FROM jsonb_array_elements(coalesce(rec->'items','[]'::jsonb)) e WHERE (e->>'score')::int > 0 LIMIT 2 LOOP
    SELECT id, version INTO m FROM training_modules WHERE slug = item->>'slug' AND is_published;
    CONTINUE WHEN m.id IS NULL;
    INSERT INTO crew_training_assignments(crew_id, module_id, module_version, source, assigned_by, invite_id, reasons, match_score)
    VALUES (NEW.crew_profile_id, m.id, m.version, 'manager', c.manager_id, NEW.id, coalesce(item->'reasons','[]'::jsonb), (item->>'score')::int)
    ON CONFLICT (crew_id, module_id) DO NOTHING;
    n := n + 1;
  END LOOP;
  NEW.improvement_status := CASE WHEN n > 0 OR 'english' = ANY(coalesce(c.prep_tracks,'{}')) THEN 'pending' ELSE 'none' END;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_interview_prescribe ON public.interview_invites;
CREATE TRIGGER trg_interview_prescribe BEFORE UPDATE OF status ON public.interview_invites
  FOR EACH ROW EXECUTE FUNCTION public.interview_prescribe_on_complete();

-- Work list for the follow-up mailer (service role only).
CREATE OR REPLACE FUNCTION public.interview_followups_due(p_limit int DEFAULT 200)
RETURNS TABLE(kind text, invite_id uuid, token text, email text, crew_id uuid, name text, company text, rank text, language text, prep_tracks text[], score numeric, attempt int, modules jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT 'reminder', i.id, i.token, i.invited_email, i.crew_profile_id, i.invited_name, c.company_name, c.rank_required, c.language, c.prep_tracks, NULL::numeric, i.reminder_count + 1, '[]'::jsonb
  FROM interview_invites i JOIN interview_campaigns c ON c.id = i.campaign_id
  WHERE c.status = 'open' AND i.status IN ('sent','opened','in_progress','claimed')
    AND i.reminder_count < 3 AND i.created_at < now() - interval '24 hours'
    AND coalesce(i.last_reminder_at, i.created_at) < now() - interval '24 hours'
    AND (i.invited_email IS NOT NULL OR i.crew_profile_id IS NOT NULL)
  UNION ALL
  SELECT 'improvement', i.id, i.token, i.invited_email, i.crew_profile_id, i.invited_name, c.company_name, c.rank_required, c.language, c.prep_tracks, i.overall_score, i.improvement_reminders + 1,
    coalesce((SELECT jsonb_agg(jsonb_build_object('title', m.title, 'token', a.token)) FROM crew_training_assignments a JOIN training_modules m ON m.id = a.module_id
              WHERE a.invite_id = i.id AND a.status <> 'completed'), '[]'::jsonb)
  FROM interview_invites i JOIN interview_campaigns c ON c.id = i.campaign_id
  WHERE i.improvement_status = 'pending' AND i.crew_profile_id IS NOT NULL AND i.improvement_reminders < 3
    AND (i.improvement_sent_at IS NULL OR i.improvement_sent_at < now() - interval '48 hours')
  LIMIT p_limit;
$$;
REVOKE ALL ON FUNCTION public.interview_followups_due(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.interview_followups_due(int) TO service_role;