CREATE TABLE public.ship_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL DEFAULT auth.uid(),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','sold','withdrawn','hidden')),
  vessel_name text,
  imo text,
  show_identity boolean NOT NULL DEFAULT false,
  vessel_type text NOT NULL,
  flag text, class_society text,
  year_built integer, builder text,
  dwt integer, gt integer, loa_m numeric, beam_m numeric,
  main_engine text, bwts text, scrubber text, eexi_cii text,
  cargo_capacity text, cargo_gear text,
  price_text text NOT NULL DEFAULT 'On request',
  location text, delivery_window text, description text,
  photos text[] NOT NULL DEFAULT '{}',
  contact_whatsapp text, contact_email text,
  seller_company text,
  authority_basis text NOT NULL CHECK (authority_basis IN ('owner','manager','mandate')),
  authority_confirmed_at timestamptz NOT NULL DEFAULT now(),
  featured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ship_listings TO authenticated;
GRANT SELECT ON public.ship_listings TO anon;
GRANT ALL ON public.ship_listings TO service_role;
ALTER TABLE public.ship_listings ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_approved_manager(_uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.manager_profiles WHERE user_id = _uid AND coalesce(admin_approved,false));
$$;

CREATE POLICY "Anyone sees active listings" ON public.ship_listings FOR SELECT USING (status IN ('active','sold'));
CREATE POLICY "Sellers see own listings" ON public.ship_listings FOR SELECT TO authenticated USING (seller_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Approved managers post" ON public.ship_listings FOR INSERT TO authenticated
  WITH CHECK (seller_id = auth.uid() AND public.is_approved_manager(auth.uid()) AND featured = false AND status = 'active');
CREATE POLICY "Sellers update own" ON public.ship_listings FOR UPDATE TO authenticated
  USING (seller_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (seller_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Sellers delete own" ON public.ship_listings FOR DELETE TO authenticated USING (seller_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.ship_listing_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    IF NEW.featured IS DISTINCT FROM OLD.featured THEN NEW.featured := OLD.featured; END IF;
    IF OLD.status = 'hidden' THEN NEW.status := 'hidden';
    ELSIF NEW.status = 'hidden' THEN NEW.status := OLD.status; END IF;
    NEW.seller_id := OLD.seller_id;
  END IF;
  IF coalesce(array_length(NEW.photos,1),0) > 8 THEN RAISE EXCEPTION 'Max 8 photos'; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_ship_listing_guard BEFORE UPDATE ON public.ship_listings FOR EACH ROW EXECUTE FUNCTION public.ship_listing_guard();

CREATE TABLE public.ship_listing_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.ship_listings(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL DEFAULT auth.uid(),
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, reporter_id)
);
GRANT SELECT, INSERT ON public.ship_listing_reports TO authenticated;
GRANT ALL ON public.ship_listing_reports TO service_role;
ALTER TABLE public.ship_listing_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Report a listing" ON public.ship_listing_reports FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid() AND length(reason) BETWEEN 3 AND 500);
CREATE POLICY "Admins read reports" ON public.ship_listing_reports FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "Ship photos read" ON storage.objects FOR SELECT USING (bucket_id = 'ship-listings');
CREATE POLICY "Approved managers upload ship photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ship-listings' AND (storage.foldername(name))[1] = auth.uid()::text AND public.is_approved_manager(auth.uid()));
CREATE POLICY "Owners delete ship photos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'ship-listings' AND (storage.foldername(name))[1] = auth.uid()::text);