DROP POLICY IF EXISTS "Owner uploads own files" ON storage.objects;
CREATE POLICY "Owner uploads own files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id IN ('crew-cvs','crew-documents','smc-documents')
  AND (storage.foldername(name))[1] = auth.uid()::text
);