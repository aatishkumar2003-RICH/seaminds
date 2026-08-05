-- Fix admin_settings SELECT exposure
DROP POLICY IF EXISTS "Authenticated users can read admin_settings" ON public.admin_settings;
DROP POLICY IF EXISTS "read_admin_settings" ON public.admin_settings;

ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can read admin_settings"
  ON public.admin_settings
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Keep existing admin write policies (they already use is_admin)

-- RPC to fetch a specific list of settings without exposing the whole table
CREATE OR REPLACE FUNCTION public.get_admin_settings(p_keys text[])
RETURNS TABLE(key text, value text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.key, s.value
  FROM public.admin_settings s
  WHERE s.key = ANY(p_keys);
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_settings(text[]) TO anon, authenticated;