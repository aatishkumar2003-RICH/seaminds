DROP POLICY IF EXISTS "Anyone sees active listings" ON public.ship_listings;
CREATE POLICY "Anyone sees active listings" ON public.ship_listings FOR SELECT
  USING (status = ANY (ARRAY['active'::text, 'sold'::text]) AND public.marketplace_is_open());