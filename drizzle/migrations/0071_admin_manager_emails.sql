CREATE OR REPLACE FUNCTION public.admin_manager_emails()
RETURNS TABLE(user_id uuid, email text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_admin'; END IF;
  RETURN QUERY SELECT m.user_id, u.email::text FROM public.manager_profiles m JOIN auth.users u ON u.id = m.user_id;
END $$;
REVOKE ALL ON FUNCTION public.admin_manager_emails() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_manager_emails() TO authenticated;