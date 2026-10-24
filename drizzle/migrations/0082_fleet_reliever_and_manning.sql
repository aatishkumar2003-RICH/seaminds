ALTER TABLE public.sea_contracts ADD COLUMN IF NOT EXISTS reliever_application_id uuid;

CREATE OR REPLACE FUNCTION public.sea_contract_reliever_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.reliever_application_id IS NOT NULL THEN
    IF NEW.reliever_application_id = NEW.application_id OR NOT public._crew_desk_app_owned(NEW.reliever_application_id) THEN
      RAISE EXCEPTION 'invalid_reliever'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_sea_contract_reliever BEFORE INSERT OR UPDATE OF reliever_application_id ON public.sea_contracts
  FOR EACH ROW EXECUTE FUNCTION public.sea_contract_reliever_guard();

CREATE TABLE public.vessel_manning (
  manager_id uuid NOT NULL DEFAULT auth.uid(),
  vessel_name text NOT NULL CHECK (length(vessel_name) BETWEEN 1 AND 120),
  required_complement int NOT NULL CHECK (required_complement BETWEEN 1 AND 80),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (manager_id, vessel_name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vessel_manning TO authenticated;
GRANT ALL ON public.vessel_manning TO service_role;
ALTER TABLE public.vessel_manning ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Manager owns manning" ON public.vessel_manning FOR ALL TO authenticated
  USING (manager_id = auth.uid()) WITH CHECK (manager_id = auth.uid());