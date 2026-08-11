DROP POLICY IF EXISTS "Managers upload company post images" ON storage.objects;
CREATE POLICY "Managers upload company post images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'company-posts'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
DROP POLICY IF EXISTS "Managers update own company post images" ON storage.objects;
CREATE POLICY "Managers update own company post images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'company-posts' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'company-posts' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "Managers delete own company post images" ON storage.objects;
CREATE POLICY "Managers delete own company post images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'company-posts' AND (storage.foldername(name))[1] = auth.uid()::text);