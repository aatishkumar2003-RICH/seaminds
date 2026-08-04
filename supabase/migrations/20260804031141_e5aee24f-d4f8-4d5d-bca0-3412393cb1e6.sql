
-- Admin helper
INSERT INTO public.admin_profiles (id, email)
VALUES ('492ee966-e015-4440-a415-6ad6275a4a9b', 'aatishkumar2003@gmail.com')
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_profiles WHERE id = _user_id)
$$;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;

-- crew_availability
DROP POLICY IF EXISTS "Anyone can insert crew_availability" ON public.crew_availability;
DROP POLICY IF EXISTS "Anyone can update crew_availability" ON public.crew_availability;
DROP POLICY IF EXISTS "Anyone can read crew_availability" ON public.crew_availability;

CREATE POLICY "Owner can insert own availability" ON public.crew_availability
  FOR INSERT TO authenticated WITH CHECK (crew_profile_id = auth.uid());
CREATE POLICY "Owner can update own availability" ON public.crew_availability
  FOR UPDATE TO authenticated USING (crew_profile_id = auth.uid()) WITH CHECK (crew_profile_id = auth.uid());
CREATE POLICY "Owner can delete own availability" ON public.crew_availability
  FOR DELETE TO authenticated USING (crew_profile_id = auth.uid());
CREATE POLICY "Read visible or own availability" ON public.crew_availability
  FOR SELECT USING (visible_to_employers = true OR crew_profile_id = auth.uid());

-- job_vacancies
DROP POLICY IF EXISTS "Managers can insert vacancies" ON public.job_vacancies;
DROP POLICY IF EXISTS "Managers can update vacancies" ON public.job_vacancies;

CREATE POLICY "Managers insert own vacancies" ON public.job_vacancies
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.manager_profiles m WHERE m.id = job_vacancies.manager_profile_id AND m.user_id = auth.uid()));
CREATE POLICY "Managers update own vacancies" ON public.job_vacancies
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.manager_profiles m WHERE m.id = job_vacancies.manager_profile_id AND m.user_id = auth.uid()) OR public.is_admin(auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.manager_profiles m WHERE m.id = job_vacancies.manager_profile_id AND m.user_id = auth.uid()) OR public.is_admin(auth.uid()));
CREATE POLICY "Managers delete own vacancies" ON public.job_vacancies
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.manager_profiles m WHERE m.id = job_vacancies.manager_profile_id AND m.user_id = auth.uid()) OR public.is_admin(auth.uid()));

-- discount_codes
DROP POLICY IF EXISTS "Authenticated can insert discount_codes" ON public.discount_codes;
DROP POLICY IF EXISTS "Authenticated can update discount_codes" ON public.discount_codes;
DROP POLICY IF EXISTS "Authenticated can delete discount_codes" ON public.discount_codes;

CREATE POLICY "Admins insert discount_codes" ON public.discount_codes
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins update discount_codes" ON public.discount_codes
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins delete discount_codes" ON public.discount_codes
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- Function hardening: fixed search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_crew_unique_id()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  new_id text;
  year_part text := EXTRACT(YEAR FROM NOW())::text;
  seq_num int;
BEGIN
  SELECT COUNT(*) + 1 INTO seq_num FROM public.crew_profiles WHERE crew_unique_id IS NOT NULL;
  new_id := 'SM-' || year_part || '-' || LPAD(seq_num::text, 5, '0');
  NEW.crew_unique_id := new_id;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.upsert_email_lead(text, text, text, text, text, text, text, text, text, uuid) SET search_path = public;

-- Revoke public execute on trigger / definer functions not meant to be called via the API
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_crew_unique_id() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.owns_crew_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owns_crew_profile(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.upsert_email_lead(text, text, text, text, text, text, text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_email_lead(text, text, text, text, text, text, text, text, text, uuid) TO authenticated, service_role;
