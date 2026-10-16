ALTER TABLE public.training_modules ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'OPERATIONAL';
UPDATE public.training_modules SET tier = 'VETTING' WHERE slug IN ('sire-2-readiness','imsbc-liquefaction','tanker-inert-gas');
UPDATE public.training_modules SET tier = 'STATUTORY' WHERE slug IN ('enclosed-space-entry','engine-room-fire','lsa-ffa-drills','ows-oil-record-book','mooring-snapback','psc-readiness','paris-tokyo-psc','amsa-pilot-transfer','uscg-environmental');

-- Catalog for signed-in crew: never returns quiz content or answer keys.
CREATE OR REPLACE FUNCTION public.training_catalog()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN auth.uid() IS NULL THEN jsonb_build_object('ok', false, 'error_code', 'AUTH_REQUIRED')
  ELSE jsonb_build_object('ok', true, 'items', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'slug', m.slug, 'title', m.title, 'summary', m.summary, 'tier', m.tier,
      'vessel_families', m.vessel_families, 'departments', m.departments,
      'media_url', m.media_url, 'media_label', m.media_label,
      'status', a.status, 'token', a.token) ORDER BY m.priority DESC, m.title)
    FROM public.training_modules m
    LEFT JOIN public.crew_training_assignments a ON a.module_id = m.id AND a.crew_id = auth.uid()
    WHERE m.is_published), '[]'::jsonb)) END
$$;
REVOKE ALL ON FUNCTION public.training_catalog() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.training_catalog() TO authenticated;
NOTIFY pgrst, 'reload schema';