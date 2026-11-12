CREATE POLICY company_crew_docs_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'company-crew-docs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY company_crew_docs_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'company-crew-docs' AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (SELECT 1 FROM public.company_crew_records r WHERE r.manager_id = auth.uid() AND r.id::text = (storage.foldername(name))[2]));
CREATE POLICY company_crew_docs_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'company-crew-docs' AND (storage.foldername(name))[1] = auth.uid()::text);