-- Replace email_leads policies to remove public UPDATE and standardize admin check
DROP POLICY IF EXISTS "Public can add a lead" ON public.email_leads;
DROP POLICY IF EXISTS "Public can upsert a lead" ON public.email_leads;
DROP POLICY IF EXISTS "Admin manages email_leads" ON public.email_leads;

ALTER TABLE public.email_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can add a lead"
  ON public.email_leads
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Admin can manage email_leads"
  ON public.email_leads
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));