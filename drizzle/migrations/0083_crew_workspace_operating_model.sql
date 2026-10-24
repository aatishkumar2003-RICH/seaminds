CREATE TABLE public.crew_workspace_settings (
  manager_id uuid PRIMARY KEY DEFAULT auth.uid(),
  operating_model text NOT NULL CHECK (operating_model IN ('crewing_agency','ship_manager')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.crew_workspace_settings TO authenticated;
GRANT ALL ON public.crew_workspace_settings TO service_role;
ALTER TABLE public.crew_workspace_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Manager owns workspace setting" ON public.crew_workspace_settings FOR ALL TO authenticated
  USING (manager_id = auth.uid()) WITH CHECK (manager_id = auth.uid());