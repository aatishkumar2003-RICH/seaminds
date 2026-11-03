CREATE POLICY dispatch_photos_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'crew-dispatches');