-- Enable RLS on app_events (policies already existed but were not enforced)
ALTER TABLE public.app_events ENABLE ROW LEVEL SECURITY;

-- Drop overly permissive public policies if they exist
DROP POLICY IF EXISTS "Anyone can insert app events" ON public.app_events;
DROP POLICY IF EXISTS "Anyone can read own app events" ON public.app_events;
DROP POLICY IF EXISTS "Authenticated users can insert app events" ON public.app_events;
DROP POLICY IF EXISTS "Users can read own app events" ON public.app_events;
DROP POLICY IF EXISTS "Admin can read all app events" ON public.app_events;

-- Recreate restrictive policies
CREATE POLICY "Authenticated users can insert app events"
  ON public.app_events
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can read own app events"
  ON public.app_events
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid()::text);

CREATE POLICY "Admin can read all app events"
  ON public.app_events
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));