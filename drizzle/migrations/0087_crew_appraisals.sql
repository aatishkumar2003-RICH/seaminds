CREATE TABLE public.crew_appraisals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL,
  contract_id uuid NOT NULL REFERENCES public.sea_contracts(id) ON DELETE RESTRICT,
  appraiser_name text NOT NULL DEFAULT '',
  appraiser_role text NOT NULL DEFAULT 'master',
  period_from date,
  period_to date,
  safety numeric(3,2) NOT NULL DEFAULT 3,
  technical numeric(3,2) NOT NULL DEFAULT 3,
  emergency numeric(3,2) NOT NULL DEFAULT 3,
  teamwork numeric(3,2) NOT NULL DEFAULT 3,
  english numeric(3,2) NOT NULL DEFAULT 3,
  leadership numeric(3,2) NOT NULL DEFAULT 3,
  overall numeric(3,2) NOT NULL DEFAULT 3,
  rehire_verdict text NOT NULL DEFAULT 'rehire',
  promotion_verdict text NOT NULL DEFAULT 'maintain_rank',
  training_needs text[] NOT NULL DEFAULT '{}',
  remarks text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  finalized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contract_id),
  CONSTRAINT appraisal_scores CHECK (safety BETWEEN 1 AND 5 AND technical BETWEEN 1 AND 5 AND emergency BETWEEN 1 AND 5 AND teamwork BETWEEN 1 AND 5 AND english BETWEEN 1 AND 5 AND leadership BETWEEN 1 AND 5),
  CONSTRAINT appraisal_role CHECK (appraiser_role IN ('master','chief_engineer','superintendent')),
  CONSTRAINT appraisal_rehire CHECK (rehire_verdict IN ('rehire','rehire_with_training','do_not_rehire')),
  CONSTRAINT appraisal_promo CHECK (promotion_verdict IN ('recommended','maintain_rank','not_ready')),
  CONSTRAINT appraisal_status CHECK (status IN ('draft','finalized'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crew_appraisals TO authenticated;
GRANT ALL ON public.crew_appraisals TO service_role;
ALTER TABLE public.crew_appraisals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages appraisals" ON public.crew_appraisals FOR ALL TO authenticated
  USING (manager_id = auth.uid()) WITH CHECK (manager_id = auth.uid());

CREATE OR REPLACE FUNCTION public.crew_appraisal_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' THEN RAISE EXCEPTION 'appraisal_locked'; END IF;
    RETURN OLD;
  END IF;
  SELECT manager_id, status INTO c FROM sea_contracts WHERE id = NEW.contract_id;
  IF c IS NULL OR c.manager_id <> auth.uid() THEN RAISE EXCEPTION 'not_owner'; END IF;
  IF TG_OP = 'INSERT' THEN
    IF c.status NOT IN ('signed','completed') THEN RAISE EXCEPTION 'contract_not_signed'; END IF;
    NEW.manager_id := auth.uid();
  ELSE
    NEW.manager_id := OLD.manager_id; NEW.contract_id := OLD.contract_id;
    IF OLD.status = 'finalized' THEN RAISE EXCEPTION 'appraisal_locked'; END IF;
  END IF;
  IF NEW.status = 'finalized' THEN
    IF length(trim(NEW.appraiser_name)) < 2 THEN RAISE EXCEPTION 'appraiser_required'; END IF;
    IF NEW.rehire_verdict = 'rehire_with_training' AND coalesce(array_length(NEW.training_needs,1),0) = 0 THEN RAISE EXCEPTION 'training_required'; END IF;
    NEW.finalized_at := now();
  END IF;
  NEW.overall := round((NEW.safety + NEW.technical + NEW.emergency + NEW.teamwork + NEW.english + NEW.leadership) / 6.0, 2);
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE TRIGGER trg_crew_appraisal_guard BEFORE INSERT OR UPDATE OR DELETE ON public.crew_appraisals
FOR EACH ROW EXECUTE FUNCTION public.crew_appraisal_guard();