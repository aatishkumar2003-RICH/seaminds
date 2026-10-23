CREATE TABLE public.lineup_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_ref text NOT NULL UNIQUE DEFAULT ('LT-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))),
  application_id uuid NOT NULL REFERENCES public.job_applications(id) ON DELETE CASCADE,
  crew_id uuid NOT NULL,
  raised_by uuid NOT NULL,
  raised_by_role text NOT NULL CHECK (raised_by_role IN ('crew','manager')),
  category text NOT NULL,
  statement text NOT NULL CHECK (length(statement) BETWEEN 10 AND 2000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_dialogue','mutually_resolved','escalated','closed')),
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  escalated_at timestamptz,
  resolved_at timestamptz
);
CREATE TABLE public.lineup_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.lineup_tickets(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  author_role text NOT NULL CHECK (author_role IN ('crew','manager','admin')),
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.lineup_tickets(application_id);
CREATE INDEX ON public.lineup_tickets(crew_id);
CREATE INDEX ON public.lineup_ticket_messages(ticket_id);
GRANT SELECT ON public.lineup_tickets, public.lineup_ticket_messages TO authenticated;
GRANT ALL ON public.lineup_tickets, public.lineup_ticket_messages TO service_role;
ALTER TABLE public.lineup_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lineup_ticket_messages ENABLE ROW LEVEL SECURITY;

-- Which side of an application the caller is on (mirrors get_my_applicants ownership).
CREATE OR REPLACE FUNCTION public.lineup_party_role(p_application_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN NULL
    WHEN ja.crew_id = auth.uid() THEN 'crew'
    WHEN EXISTS (SELECT 1 FROM company_posts cp WHERE cp.id = ja.company_post_id AND cp.manager_id = auth.uid())
      OR EXISTS (SELECT 1 FROM job_postings jp WHERE jp.id = ja.job_posting_id AND (
           jp.manager_id = auth.uid()
           OR (jp.manager_id IS NULL AND lower(trim(jp.company_name)) =
               (SELECT lower(trim(mp.company_name)) FROM manager_profiles mp WHERE mp.user_id = auth.uid() AND mp.company_name IS NOT NULL LIMIT 1))))
      THEN 'manager'
    WHEN auth.uid() = '492ee966-e015-4440-a415-6ad6275a4a9b'::uuid THEN 'admin'
    ELSE NULL END
  FROM job_applications ja WHERE ja.id = p_application_id
$$;
REVOKE ALL ON FUNCTION public.lineup_party_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lineup_party_role(uuid) TO authenticated;

CREATE POLICY "Parties read lineup tickets" ON public.lineup_tickets FOR SELECT TO authenticated
  USING (public.lineup_party_role(application_id) IS NOT NULL);
CREATE POLICY "Parties read lineup ticket messages" ON public.lineup_ticket_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.lineup_tickets t WHERE t.id = ticket_id AND public.lineup_party_role(t.application_id) IS NOT NULL));

CREATE OR REPLACE FUNCTION public.raise_lineup_ticket(p_application_id uuid, p_category text, p_statement text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r text := public.lineup_party_role(p_application_id); app job_applications%ROWTYPE; t lineup_tickets%ROWTYPE;
BEGIN
  IF r IS NULL OR r = 'admin' THEN RETURN jsonb_build_object('ok',false,'error','not_a_party'); END IF;
  SELECT * INTO app FROM job_applications WHERE id = p_application_id;
  IF app.outcome NOT IN ('shortlisted','offered','placed') THEN RETURN jsonb_build_object('ok',false,'error','no_active_lineup'); END IF;
  IF (r = 'crew' AND p_category NOT IN ('delayed_joining','contract_wage_dispute','repatriation_assistance','unilateral_cancellation','other'))
     OR (r = 'manager' AND p_category NOT IN ('no_show','medical_discrepancy','double_commitment','document_issue','other')) THEN
    RETURN jsonb_build_object('ok',false,'error','invalid_category');
  END IF;
  IF length(trim(coalesce(p_statement,''))) < 10 THEN RETURN jsonb_build_object('ok',false,'error','statement_too_short'); END IF;
  IF EXISTS (SELECT 1 FROM lineup_tickets WHERE application_id = p_application_id AND category = p_category AND status IN ('open','in_dialogue','escalated')) THEN
    RETURN jsonb_build_object('ok',false,'error','already_open');
  END IF;
  INSERT INTO lineup_tickets (application_id, crew_id, raised_by, raised_by_role, category, statement,
     status, escalated_at)
  VALUES (p_application_id, app.crew_id, auth.uid(), r, p_category, left(trim(p_statement),2000),
     CASE WHEN p_category = 'repatriation_assistance' THEN 'escalated' ELSE 'open' END,
     CASE WHEN p_category = 'repatriation_assistance' THEN now() END)
  RETURNING * INTO t;
  IF r = 'manager' THEN
    INSERT INTO notifications (crew_id, kind, title, body, icon, screen) VALUES
      (app.crew_id, 'lineup_ticket', 'The company raised an issue about your joining',
       'Ticket ' || t.ticket_ref || ' — open your job offers to read it and reply within 48 hours.', '⚖️', 'jobs');
  END IF;
  INSERT INTO app_events (event_type, message, severity, metadata) VALUES
    ('lineup_ticket', 'Lineup ticket raised', CASE WHEN t.status='escalated' THEN 'warning' ELSE 'info' END,
     jsonb_build_object('ticket_ref', t.ticket_ref, 'category', p_category, 'by', r));
  RETURN jsonb_build_object('ok',true,'ticket_id',t.id,'ticket_ref',t.ticket_ref,'status',t.status);
END $$;

CREATE OR REPLACE FUNCTION public.reply_lineup_ticket(p_ticket_id uuid, p_body text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t lineup_tickets%ROWTYPE; r text;
BEGIN
  SELECT * INTO t FROM lineup_tickets WHERE id = p_ticket_id;
  IF t.id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not_found'); END IF;
  r := public.lineup_party_role(t.application_id);
  IF r IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not_a_party'); END IF;
  IF t.status IN ('mutually_resolved','closed') THEN RETURN jsonb_build_object('ok',false,'error','ticket_closed'); END IF;
  IF length(trim(coalesce(p_body,''))) = 0 THEN RETURN jsonb_build_object('ok',false,'error','empty'); END IF;
  INSERT INTO lineup_ticket_messages (ticket_id, author_id, author_role, body) VALUES (t.id, auth.uid(), r, left(trim(p_body),2000));
  UPDATE lineup_tickets SET status = CASE WHEN status='open' AND r <> t.raised_by_role THEN 'in_dialogue' ELSE status END,
         updated_at = now() WHERE id = t.id;
  IF r <> 'crew' THEN
    INSERT INTO notifications (crew_id, kind, title, body, icon, screen) VALUES
      (t.crew_id, 'lineup_ticket', 'New reply on ticket ' || t.ticket_ref, left(trim(p_body),140), '⚖️', 'jobs');
  END IF;
  RETURN jsonb_build_object('ok',true);
END $$;

-- action: 'resolve' (either party), 'escalate' (either party, after 48h or no reply), 'close' (admin)
CREATE OR REPLACE FUNCTION public.set_lineup_ticket_status(p_ticket_id uuid, p_action text, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t lineup_tickets%ROWTYPE; r text;
BEGIN
  SELECT * INTO t FROM lineup_tickets WHERE id = p_ticket_id;
  IF t.id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not_found'); END IF;
  r := public.lineup_party_role(t.application_id);
  IF r IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not_a_party'); END IF;
  IF t.status IN ('mutually_resolved','closed') THEN RETURN jsonb_build_object('ok',false,'error','ticket_closed'); END IF;
  IF p_action = 'resolve' THEN
    UPDATE lineup_tickets SET status='mutually_resolved', resolved_at=now(), updated_at=now(), resolution_note=left(p_note,1000) WHERE id=t.id;
  ELSIF p_action = 'escalate' THEN
    IF t.status = 'escalated' THEN RETURN jsonb_build_object('ok',false,'error','already_escalated'); END IF;
    IF t.created_at > now() - interval '48 hours' AND r = t.raised_by_role THEN
      RETURN jsonb_build_object('ok',false,'error','grace_period','escalate_after', t.created_at + interval '48 hours');
    END IF;
    UPDATE lineup_tickets SET status='escalated', escalated_at=now(), updated_at=now() WHERE id=t.id;
    INSERT INTO app_events (event_type, message, severity, metadata) VALUES
      ('lineup_ticket', 'Lineup ticket escalated to SeaMinds', 'warning', jsonb_build_object('ticket_ref', t.ticket_ref, 'category', t.category));
  ELSIF p_action = 'close' AND r = 'admin' THEN
    UPDATE lineup_tickets SET status='closed', resolved_at=now(), updated_at=now(), resolution_note=left(p_note,1000) WHERE id=t.id;
  ELSE
    RETURN jsonb_build_object('ok',false,'error','invalid_action');
  END IF;
  IF p_note IS NOT NULL AND length(trim(p_note)) > 0 THEN
    INSERT INTO lineup_ticket_messages (ticket_id, author_id, author_role, body) VALUES (t.id, auth.uid(), r, left(trim(p_note),2000));
  END IF;
  RETURN jsonb_build_object('ok',true);
END $$;

REVOKE ALL ON FUNCTION public.raise_lineup_ticket(uuid,text,text), public.reply_lineup_ticket(uuid,text), public.set_lineup_ticket_status(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.raise_lineup_ticket(uuid,text,text), public.reply_lineup_ticket(uuid,text), public.set_lineup_ticket_status(uuid,text,text) TO authenticated;
NOTIFY pgrst, 'reload schema';