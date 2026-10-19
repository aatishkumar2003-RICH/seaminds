DROP POLICY IF EXISTS "Ship photos read" ON storage.objects;
CREATE OR REPLACE FUNCTION public.ship_photo_visible(_path text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.ship_listings l WHERE _path = ANY(l.photos)
    AND (l.status IN ('active','sold') OR l.seller_id = auth.uid() OR public.is_admin(auth.uid())));
$$;
CREATE POLICY "Ship photos of listed vessels" ON storage.objects FOR SELECT
  USING (bucket_id = 'ship-listings' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.ship_photo_visible(name)));