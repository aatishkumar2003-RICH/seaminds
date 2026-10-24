CREATE TABLE public.marketplace_sellers (
  user_id uuid PRIMARY KEY,
  approved_at timestamptz NOT NULL DEFAULT now(),
  approved_by uuid
);
GRANT SELECT ON public.marketplace_sellers TO authenticated;
GRANT ALL ON public.marketplace_sellers TO service_role;
ALTER TABLE public.marketplace_sellers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own or admin reads sellers" ON public.marketplace_sellers FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.is_marketplace_seller(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin(_uid)
      OR (public.is_approved_manager(_uid) AND EXISTS (SELECT 1 FROM public.marketplace_sellers WHERE user_id = _uid));
$$;

DROP POLICY IF EXISTS "Approved managers post" ON public.ship_listings;
CREATE POLICY "Approved managers post" ON public.ship_listings FOR INSERT TO authenticated
  WITH CHECK (seller_id = auth.uid() AND public.is_marketplace_seller(auth.uid()) AND featured = false AND status = 'active');

DROP POLICY IF EXISTS "Approved managers upload ship photos" ON storage.objects;
CREATE POLICY "Approved managers upload ship photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ship-listings' AND (storage.foldername(name))[1] = auth.uid()::text AND public.is_marketplace_seller(auth.uid()));