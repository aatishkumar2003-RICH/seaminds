CREATE OR REPLACE FUNCTION public.protect_manager_approval_flags()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND auth.uid() <> '492ee966-e015-4440-a415-6ad6275a4a9b'::uuid THEN
    NEW.admin_approved   := OLD.admin_approved;
    NEW.company_verified := OLD.company_verified;
    NEW.fleet_active     := OLD.fleet_active;
    NEW.fleet_until      := OLD.fleet_until;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_manager_approval_flags ON public.manager_profiles;
CREATE TRIGGER trg_protect_manager_approval_flags
BEFORE UPDATE ON public.manager_profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_manager_approval_flags();