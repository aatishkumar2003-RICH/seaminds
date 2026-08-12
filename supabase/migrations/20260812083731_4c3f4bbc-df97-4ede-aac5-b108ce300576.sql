CREATE TABLE IF NOT EXISTS public.contact_reveals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_user_id uuid NOT NULL,
  crew_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (manager_user_id, crew_id));

GRANT SELECT ON public.contact_reveals TO authenticated;
GRANT ALL ON public.contact_reveals TO service_role;

ALTER TABLE public.contact_reveals ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_user_id uuid NOT NULL,
  delta int NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now());

CREATE INDEX IF NOT EXISTS idx_credit_ledger_mgr ON public.credit_ledger (manager_user_id);

GRANT SELECT ON public.credit_ledger TO authenticated;
GRANT ALL ON public.credit_ledger TO service_role;

ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "manager_reads_own_ledger" ON public.credit_ledger;
CREATE POLICY "manager_reads_own_ledger" ON public.credit_ledger FOR SELECT TO authenticated USING (manager_user_id = auth.uid());

DROP POLICY IF EXISTS "manager_reads_own_reveals" ON public.contact_reveals;
CREATE POLICY "manager_reads_own_reveals" ON public.contact_reveals FOR SELECT TO authenticated USING (manager_user_id = auth.uid());