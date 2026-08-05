-- Fix error-level security findings by replacing permissive policies

-- ============================================
-- app_events
-- ============================================
DROP POLICY IF EXISTS "insert_events" ON public.app_events;
DROP POLICY IF EXISTS "service_read" ON public.app_events;

-- Existing good policies remain:
-- "Authenticated users can insert app events"
-- "Users can read own app events"
-- "Admin can read all app events"

-- ============================================
-- admin_settings
-- ============================================
DROP POLICY IF EXISTS "Authenticated can insert admin_settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Authenticated can update admin_settings" ON public.admin_settings;
DROP POLICY IF EXISTS "read_admin_settings" ON public.admin_settings;

ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read admin_settings"
  ON public.admin_settings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can insert admin_settings"
  ON public.admin_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admin can update admin_settings"
  ON public.admin_settings
  FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ============================================
-- country_pricing
-- ============================================
DROP POLICY IF EXISTS "Authenticated can insert country_pricing" ON public.country_pricing;
DROP POLICY IF EXISTS "Authenticated can update country_pricing" ON public.country_pricing;
DROP POLICY IF EXISTS "read_country_pricing" ON public.country_pricing;

ALTER TABLE public.country_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read country_pricing"
  ON public.country_pricing
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can insert country_pricing"
  ON public.country_pricing
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admin can update country_pricing"
  ON public.country_pricing
  FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ============================================
-- dpa_contacts
-- ============================================
DROP POLICY IF EXISTS "admin_dpa" ON public.dpa_contacts;
DROP POLICY IF EXISTS "authenticated_delete_dpa" ON public.dpa_contacts;
DROP POLICY IF EXISTS "authenticated_insert_dpa" ON public.dpa_contacts;
DROP POLICY IF EXISTS "authenticated_update_dpa" ON public.dpa_contacts;
DROP POLICY IF EXISTS "read_dpa" ON public.dpa_contacts;

ALTER TABLE public.dpa_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read dpa_contacts"
  ON public.dpa_contacts
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can insert dpa_contacts"
  ON public.dpa_contacts
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admin can update dpa_contacts"
  ON public.dpa_contacts
  FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admin can delete dpa_contacts"
  ON public.dpa_contacts
  FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));