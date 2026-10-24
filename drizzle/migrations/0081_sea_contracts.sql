CREATE TABLE public.sea_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL,
  manager_id uuid NOT NULL DEFAULT auth.uid(),
  crew_id uuid,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','issued','signed','completed','cancelled')),
  employer_name text NOT NULL DEFAULT '',
  employer_address text NOT NULL DEFAULT '',
  rank text NOT NULL DEFAULT '',
  vessel_name text NOT NULL DEFAULT '',
  imo_number text NOT NULL DEFAULT '',
  flag_state text NOT NULL DEFAULT '',
  vessel_type text NOT NULL DEFAULT '',
  port_of_engagement text NOT NULL DEFAULT '',
  repatriation_port text NOT NULL DEFAULT '',
  start_date date,
  duration_months numeric(4,1) NOT NULL DEFAULT 6 CHECK (duration_months > 0 AND duration_months <= 12),
  tolerance_months numeric(3,1) NOT NULL DEFAULT 1 CHECK (tolerance_months >= 0 AND tolerance_months <= 3),
  notice_days int NOT NULL DEFAULT 30 CHECK (notice_days >= 7 AND notice_days <= 90),
  cba_reference text NOT NULL DEFAULT '',
  currency text NOT NULL DEFAULT 'USD',
  basic_wage numeric(12,2) NOT NULL DEFAULT 0 CHECK (basic_wage >= 0),
  fixed_overtime numeric(12,2) NOT NULL DEFAULT 0 CHECK (fixed_overtime >= 0),
  overtime_hours int NOT NULL DEFAULT 0 CHECK (overtime_hours >= 0 AND overtime_hours <= 200),
  extra_ot_rate numeric(10,2) NOT NULL DEFAULT 0 CHECK (extra_ot_rate >= 0),
  leave_days_per_month numeric(4,2) NOT NULL DEFAULT 2.5 CHECK (leave_days_per_month >= 2.5),
  leave_pay numeric(12,2) NOT NULL DEFAULT 0 CHECK (leave_pay >= 0),
  allowances jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text NOT NULL DEFAULT '',
  issued_at timestamptz, signed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sea_contracts_manager_idx ON public.sea_contracts(manager_id, created_at DESC);
CREATE INDEX sea_contracts_crew_idx ON public.sea_contracts(crew_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sea_contracts TO authenticated;
GRANT ALL ON public.sea_contracts TO service_role;
ALTER TABLE public.sea_contracts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.sea_contract_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.manager_id := auth.uid();
    IF NOT public._crew_desk_app_owned(NEW.application_id) THEN RAISE EXCEPTION 'not_owner'; END IF;
    SELECT crew_id INTO NEW.crew_id FROM job_applications WHERE id = NEW.application_id;
    IF NOT EXISTS (SELECT 1 FROM job_applications WHERE id = NEW.application_id AND (crew_accepted_at IS NOT NULL OR outcome='placed')) THEN
      RAISE EXCEPTION 'crew_not_confirmed'; END IF;
    NEW.status := 'draft'; NEW.issued_at := NULL; NEW.signed_at := NULL;
  ELSE
    NEW.manager_id := OLD.manager_id; NEW.crew_id := OLD.crew_id; NEW.application_id := OLD.application_id;
    IF OLD.status IN ('completed','cancelled') THEN RAISE EXCEPTION 'contract_closed'; END IF;
    IF OLD.status IN ('signed') AND NEW.status NOT IN ('signed','completed','cancelled') THEN RAISE EXCEPTION 'invalid_transition'; END IF;
    IF OLD.status <> 'draft' AND NEW.status = 'draft' THEN RAISE EXCEPTION 'invalid_transition'; END IF;
    IF NEW.status = 'issued' AND OLD.status = 'draft' THEN NEW.issued_at := now(); END IF;
    IF NEW.status = 'signed' AND OLD.status <> 'signed' THEN NEW.signed_at := now(); NEW.issued_at := coalesce(OLD.issued_at, now()); END IF;
    IF OLD.status = 'signed' AND (NEW.basic_wage, NEW.fixed_overtime, NEW.leave_pay, NEW.allowances, NEW.start_date, NEW.duration_months)
       IS DISTINCT FROM (OLD.basic_wage, OLD.fixed_overtime, OLD.leave_pay, OLD.allowances, OLD.start_date, OLD.duration_months) THEN
      RAISE EXCEPTION 'signed_terms_locked'; END IF;
    NEW.updated_at := now();
  END IF;
  IF jsonb_typeof(NEW.allowances) <> 'array' OR jsonb_array_length(NEW.allowances) > 12 THEN RAISE EXCEPTION 'invalid_allowances'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_sea_contract_guard BEFORE INSERT OR UPDATE ON public.sea_contracts FOR EACH ROW EXECUTE FUNCTION public.sea_contract_guard();

CREATE POLICY "Manager manages own SEA" ON public.sea_contracts FOR ALL TO authenticated
  USING (manager_id = auth.uid() AND public._crew_desk_app_owned(application_id))
  WITH CHECK (manager_id = auth.uid() AND public._crew_desk_app_owned(application_id));
CREATE POLICY "Crew views issued SEA" ON public.sea_contracts FOR SELECT TO authenticated
  USING (crew_id = auth.uid() AND status IN ('issued','signed','completed'));
CREATE POLICY "Delete drafts only" ON public.sea_contracts AS RESTRICTIVE FOR DELETE TO authenticated
  USING (status = 'draft');