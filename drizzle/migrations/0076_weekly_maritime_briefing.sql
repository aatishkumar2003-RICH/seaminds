CREATE TABLE public.briefing_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  audience text NOT NULL,
  post_id uuid,
  ok boolean NOT NULL DEFAULT true,
  error text,
  sent_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.briefing_log TO service_role;
GRANT SELECT ON public.briefing_log TO authenticated;
ALTER TABLE public.briefing_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin reads briefing log" ON public.briefing_log FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE INDEX briefing_log_user_idx ON public.briefing_log (user_id, sent_at DESC);
CREATE INDEX briefing_log_sent_idx ON public.briefing_log (sent_at DESC);

CREATE TABLE public.briefing_optout (
  user_id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.briefing_optout TO service_role;
ALTER TABLE public.briefing_optout ENABLE ROW LEVEL SECURITY;