CREATE TABLE public.fleet_staff_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  email text,
  full_name text,
  requested_role text NOT NULL CHECK (requested_role IN ('technical_manager','technical_superintendent','marine_superintendent','purchasing_officer','accounts_officer','crewing_officer','crewing_manager','ship_master','chief_engineer','vessel_owner','approval_admin')),
  approved_role text,
  company text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','suspended')),
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fleet_staff_members TO authenticated;
GRANT ALL ON public.fleet_staff_members TO service_role;
ALTER TABLE public.fleet_staff_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own request read" ON public.fleet_staff_members FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "own request create" ON public.fleet_staff_members FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND status = 'pending' AND approved_role IS NULL AND approved_by IS NULL);
CREATE POLICY "admin manage" ON public.fleet_staff_members FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "admin delete" ON public.fleet_staff_members FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
CREATE TRIGGER fleet_staff_touch BEFORE UPDATE ON public.fleet_staff_members FOR EACH ROW EXECUTE FUNCTION public.fleet_touch();
NOTIFY pgrst, 'reload schema';