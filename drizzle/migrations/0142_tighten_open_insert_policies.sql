DROP POLICY IF EXISTS "Public can add a lead" ON public.email_leads;
CREATE POLICY "Public can add a lead" ON public.email_leads FOR INSERT TO public
WITH CHECK (length(email) BETWEEN 3 AND 320 AND position('@' in email) > 1 AND coalesce(converted,false) = false AND coalesce(promo_sent,false) = false AND coalesce(email_verified,false) = false AND coalesce(phone_verified,false) = false AND verified_at IS NULL AND notes IS NULL AND (crew_profile_id IS NULL OR crew_profile_id = auth.uid()));

DROP POLICY IF EXISTS "Anyone can insert vessel_ratings" ON public.vessel_ratings;
CREATE POLICY "Anyone can insert vessel_ratings" ON public.vessel_ratings FOR INSERT TO public
WITH CHECK (length(vessel_name) BETWEEN 1 AND 200 AND length(vessel_type) <= 100 AND coalesce(length(company),0) <= 200 AND coalesce(length(comment),0) <= 2000
  AND food BETWEEN 1 AND 5 AND accommodation BETWEEN 1 AND 5 AND officers BETWEEN 1 AND 5 AND work_hours BETWEEN 1 AND 5 AND internet BETWEEN 1 AND 5 AND safety BETWEEN 1 AND 5);

DROP POLICY IF EXISTS "Anyone can insert nps_responses" ON public.nps_responses;
CREATE POLICY "Anyone can insert nps_responses" ON public.nps_responses FOR INSERT TO public
WITH CHECK (score BETWEEN 0 AND 10 AND coalesce(length(comment),0) <= 2000);

DROP POLICY IF EXISTS "Public can insert signup_log" ON public.signup_log;
CREATE POLICY "Public can insert signup_log" ON public.signup_log FOR INSERT TO public
WITH CHECK (coalesce(notified,false) = false AND coalesce(length(email),0) <= 320 AND coalesce(length(first_name),0) <= 100 AND coalesce(length(last_name),0) <= 100 AND coalesce(length(role),0) <= 120 AND coalesce(length(ship_name),0) <= 200);

DROP POLICY IF EXISTS "Anyone can insert demo requests" ON public.company_demo_requests;
CREATE POLICY "Anyone can insert demo requests" ON public.company_demo_requests FOR INSERT TO public
WITH CHECK (length(company_name) BETWEEN 1 AND 200 AND length(contact_name) BETWEEN 1 AND 200 AND length(email) BETWEEN 3 AND 320 AND position('@' in email) > 1 AND coalesce(length(fleet_size),0) <= 50 AND coalesce(length(message),0) <= 4000);

DROP POLICY IF EXISTS "Authenticated can insert safety reports" ON public.safety_reports;
CREATE POLICY "Authenticated can insert safety reports" ON public.safety_reports FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND length(ship_name) BETWEEN 1 AND 200 AND coalesce(length(manning_agency),0) <= 200 AND length(category) BETWEEN 1 AND 100 AND length(description) BETWEEN 1 AND 5000 AND status IN ('pending','new','submitted','open'));

DROP POLICY IF EXISTS "Signed-in users can upload job fliers" ON storage.objects;
CREATE POLICY "Signed-in users can upload job fliers" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'job-fliers' AND (storage.foldername(name))[1] = (select auth.uid()::text));

DROP POLICY IF EXISTS "dispatch_photos_read" ON storage.objects;
CREATE POLICY "dispatch_photos_read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'crew-dispatches' AND ((storage.foldername(name))[1] = (select auth.uid()::text)
  OR EXISTS (SELECT 1 FROM public.crew_dispatches d WHERE d.photo_path = objects.name AND d.status = 'published')));