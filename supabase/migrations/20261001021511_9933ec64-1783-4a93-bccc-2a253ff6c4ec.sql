CREATE TABLE public.fleet_cells (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  superintendent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.fleet_vessels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  imo text,
  flag text,
  vessel_type text,
  owner_company text,
  cell_id uuid REFERENCES public.fleet_cells(id) ON DELETE SET NULL,
  inspection_id uuid,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('prospect','active','handed_over')),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.management_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vessel_id uuid NOT NULL REFERENCES public.fleet_vessels(id) ON DELETE CASCADE,
  starts_on date NOT NULL DEFAULT current_date,
  ends_on date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX one_active_period_per_vessel ON public.management_periods(vessel_id) WHERE status='active';
CREATE INDEX ON public.fleet_vessels(cell_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fleet_cells, public.fleet_vessels, public.management_periods TO authenticated;
GRANT ALL ON public.fleet_cells, public.fleet_vessels, public.management_periods TO service_role;

ALTER TABLE public.fleet_cells ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_vessels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.management_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin all cells" ON public.fleet_cells FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "admin all vessels" ON public.fleet_vessels FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "admin all periods" ON public.management_periods FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.fleet_touch() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
CREATE TRIGGER t1 BEFORE UPDATE ON public.fleet_cells FOR EACH ROW EXECUTE FUNCTION public.fleet_touch();
CREATE TRIGGER t2 BEFORE UPDATE ON public.fleet_vessels FOR EACH ROW EXECUTE FUNCTION public.fleet_touch();
CREATE TRIGGER t3 BEFORE UPDATE ON public.management_periods FOR EACH ROW EXECUTE FUNCTION public.fleet_touch();

-- New active vessel auto-opens a management period
CREATE OR REPLACE FUNCTION public.fleet_open_period() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.status='active' THEN INSERT INTO management_periods(vessel_id) VALUES (NEW.id) ON CONFLICT DO NOTHING; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER t_open AFTER INSERT ON public.fleet_vessels FOR EACH ROW EXECUTE FUNCTION public.fleet_open_period();
NOTIFY pgrst, 'reload schema';