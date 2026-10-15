CREATE TABLE public.recruiter_outreach_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  recruiter_name text,
  active_vacancies integer NOT NULL DEFAULT 0,
  applications_total integer NOT NULL DEFAULT 0,
  top_ranks text[] NOT NULL DEFAULT '{}',
  stage text NOT NULL DEFAULT 'new' CHECK (stage IN ('new','engaging','nurture','replied','joined','unsubscribed','bounced','paused')),
  touches_sent integer NOT NULL DEFAULT 0,
  last_kind text,
  last_contacted_at timestamptz,
  next_due_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.recruiter_outreach_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.recruiter_outreach_contacts(id) ON DELETE CASCADE,
  kind text NOT NULL,
  subject text,
  provider_id text,
  ok boolean NOT NULL DEFAULT true,
  error text,
  sent_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.recruiter_outreach_contacts TO authenticated;
GRANT SELECT ON public.recruiter_outreach_log TO authenticated;
GRANT ALL ON public.recruiter_outreach_contacts TO service_role;
GRANT ALL ON public.recruiter_outreach_log TO service_role;
ALTER TABLE public.recruiter_outreach_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruiter_outreach_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read contacts" ON public.recruiter_outreach_contacts FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "admin update contacts" ON public.recruiter_outreach_contacts FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "admin read log" ON public.recruiter_outreach_log FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE INDEX recruiter_outreach_due_idx ON public.recruiter_outreach_contacts (stage, next_due_at);
CREATE INDEX recruiter_outreach_log_contact_idx ON public.recruiter_outreach_log (contact_id, sent_at DESC);

-- Sync recruiter contacts from live vacancies; marks contacts who registered as ShipManagers as joined.
CREATE OR REPLACE FUNCTION public.recruiter_outreach_sync() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n_new int; n_joined int;
BEGIN
  WITH src AS (
    SELECT lower(trim(jp.contact_email)) AS email,
           (array_agg(jp.recruiter_name ORDER BY jp.created_at DESC) FILTER (WHERE jp.recruiter_name IS NOT NULL))[1] AS rname,
           count(*) FILTER (WHERE jp.status='active')::int AS active,
           (SELECT count(*) FROM job_applications ja WHERE ja.job_posting_id = ANY(array_agg(jp.id)) OR ja.vacancy_id = ANY(array_agg(jp.id)))::int AS apps,
           (array_agg(DISTINCT jp.rank_required) FILTER (WHERE jp.rank_required IS NOT NULL))[1:5] AS ranks
    FROM job_postings jp
    WHERE jp.contact_email ~* '^[^@\s]+@[^@\s]+\.[a-z]{2,}$'
      AND lower(jp.contact_email) NOT LIKE '%@seaminds.life'
    GROUP BY 1
  ), up AS (
    INSERT INTO recruiter_outreach_contacts (email, recruiter_name, active_vacancies, applications_total, top_ranks)
    SELECT email, rname, active, apps, coalesce(ranks,'{}') FROM src
    ON CONFLICT (email) DO UPDATE SET recruiter_name = coalesce(EXCLUDED.recruiter_name, recruiter_outreach_contacts.recruiter_name),
      active_vacancies = EXCLUDED.active_vacancies, applications_total = EXCLUDED.applications_total,
      top_ranks = EXCLUDED.top_ranks, updated_at = now()
    RETURNING (xmax = 0) AS inserted
  ) SELECT count(*) FILTER (WHERE inserted) INTO n_new FROM up;

  UPDATE recruiter_outreach_contacts c SET stage='joined', updated_at=now()
  WHERE c.stage NOT IN ('joined','unsubscribed','bounced')
    AND EXISTS (SELECT 1 FROM auth.users u JOIN manager_profiles mp ON mp.user_id=u.id WHERE lower(u.email)=c.email);
  GET DIAGNOSTICS n_joined = ROW_COUNT;
  RETURN jsonb_build_object('new', n_new, 'joined', n_joined);
END $$;
REVOKE ALL ON FUNCTION public.recruiter_outreach_sync() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recruiter_outreach_sync() TO service_role;
NOTIFY pgrst, 'reload schema';