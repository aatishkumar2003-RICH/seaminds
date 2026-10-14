ALTER TABLE public.manager_profiles ADD COLUMN IF NOT EXISTS marketing_emails boolean NOT NULL DEFAULT true;
CREATE TABLE public.manager_engagement_log (
  manager_user_id uuid NOT NULL,
  kind text NOT NULL,
  sent_on date NOT NULL DEFAULT current_date,
  PRIMARY KEY (manager_user_id, kind)
);
GRANT ALL ON public.manager_engagement_log TO service_role;
ALTER TABLE public.manager_engagement_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin reads engagement log" ON public.manager_engagement_log FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
GRANT SELECT ON public.manager_engagement_log TO authenticated;