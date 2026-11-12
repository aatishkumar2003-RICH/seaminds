DROP POLICY IF EXISTS dispatch_photos_read ON storage.objects;
CREATE POLICY dispatch_photos_read ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'crew-dispatches' AND (
    (storage.foldername(name))[1] = (select auth.uid())::text
    OR EXISTS (SELECT 1 FROM public.crew_dispatches d WHERE d.photo_path = storage.objects.name)
  )
);