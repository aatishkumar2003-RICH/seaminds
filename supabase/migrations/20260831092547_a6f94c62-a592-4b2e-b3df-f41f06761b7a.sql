ALTER TABLE public.rank_taxonomy ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rank_taxonomy_public_read" ON public.rank_taxonomy;

CREATE POLICY "rank_taxonomy_public_read" ON public.rank_taxonomy FOR SELECT TO anon, authenticated USING (true);

NOTIFY pgrst, 'reload schema';