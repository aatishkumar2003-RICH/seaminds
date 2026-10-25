CREATE TABLE public.portage_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL,
  contract_id uuid NOT NULL REFERENCES public.sea_contracts(id) ON DELETE RESTRICT,
  year_month text NOT NULL,
  days_served numeric NOT NULL DEFAULT 0,
  days_in_month integer NOT NULL DEFAULT 30,
  extra_ot_hours numeric NOT NULL DEFAULT 0,
  bonus numeric NOT NULL DEFAULT 0,
  prev_balance numeric NOT NULL DEFAULT 0,
  allotment numeric NOT NULL DEFAULT 0,
  cash_advance numeric NOT NULL DEFAULT 0,
  bond_store numeric NOT NULL DEFAULT 0,
  communication numeric NOT NULL DEFAULT 0,
  other_deduction numeric NOT NULL DEFAULT 0,
  gross numeric NOT NULL DEFAULT 0,
  deductions numeric NOT NULL DEFAULT 0,
  net_payable numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'draft',
  notes text NOT NULL DEFAULT '',
  finalized_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contract_id, year_month),
  CONSTRAINT portage_ym_fmt CHECK (year_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  CONSTRAINT portage_status_chk CHECK (status IN ('draft','finalized','paid')),
  CONSTRAINT portage_nonneg CHECK (days_served >= 0 AND extra_ot_hours >= 0 AND bonus >= 0 AND allotment >= 0 AND cash_advance >= 0 AND bond_store >= 0 AND communication >= 0 AND other_deduction >= 0)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portage_entries TO authenticated;
GRANT ALL ON public.portage_entries TO service_role;
ALTER TABLE public.portage_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages portage" ON public.portage_entries FOR ALL TO authenticated
  USING (manager_id = auth.uid()) WITH CHECK (manager_id = auth.uid());

CREATE OR REPLACE FUNCTION public.portage_entry_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' THEN RAISE EXCEPTION 'portage_locked'; END IF;
    RETURN OLD;
  END IF;
  SELECT manager_id, status, currency INTO c FROM sea_contracts WHERE id = NEW.contract_id;
  IF c IS NULL OR c.manager_id <> auth.uid() THEN RAISE EXCEPTION 'not_owner'; END IF;
  IF TG_OP = 'INSERT' THEN
    IF c.status NOT IN ('signed','completed') THEN RAISE EXCEPTION 'contract_not_signed'; END IF;
    NEW.manager_id := auth.uid();
    NEW.status := 'draft';
  ELSE
    NEW.manager_id := OLD.manager_id; NEW.contract_id := OLD.contract_id; NEW.year_month := OLD.year_month;
    IF OLD.status = 'paid' THEN RAISE EXCEPTION 'portage_locked'; END IF;
    IF OLD.status = 'finalized' AND (NEW.status NOT IN ('finalized','paid','draft')
       OR (NEW.status = 'finalized' AND (NEW.net_payable, NEW.gross, NEW.deductions) IS DISTINCT FROM (OLD.net_payable, OLD.gross, OLD.deductions))) THEN
      RAISE EXCEPTION 'portage_locked';
    END IF;
    IF OLD.status = 'draft' AND NEW.status = 'paid' THEN RAISE EXCEPTION 'invalid_transition'; END IF;
    IF NEW.status = 'finalized' AND OLD.status = 'draft' THEN NEW.finalized_at := now(); END IF;
    IF NEW.status = 'paid' AND OLD.status = 'finalized' THEN NEW.paid_at := now(); END IF;
    IF NEW.status = 'draft' THEN NEW.finalized_at := NULL; END IF;
  END IF;
  NEW.currency := c.currency;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE TRIGGER trg_portage_entry_guard BEFORE INSERT OR UPDATE OR DELETE ON public.portage_entries
FOR EACH ROW EXECUTE FUNCTION public.portage_entry_guard();
CREATE INDEX portage_entries_mgr_month ON public.portage_entries(manager_id, year_month);