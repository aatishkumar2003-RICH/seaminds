CREATE TABLE public.crew_digest_log (
  crew_id uuid NOT NULL,
  vacancy_key text NOT NULL,
  sent_on date NOT NULL DEFAULT current_date,
  PRIMARY KEY (crew_id, vacancy_key)
);
GRANT ALL ON public.crew_digest_log TO service_role;
ALTER TABLE public.crew_digest_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX crew_digest_log_sent_on ON public.crew_digest_log (sent_on);