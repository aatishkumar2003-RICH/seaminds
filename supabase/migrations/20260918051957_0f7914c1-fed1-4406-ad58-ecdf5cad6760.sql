
REVOKE EXECUTE ON FUNCTION public.takeover_can_read(uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.takeover_can_edit(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.takeover_can_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.takeover_can_edit(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.takeover_create_inspection(text,text,text,text,text,text,date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.takeover_add_member(uuid,text,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.takeover_remove_member(uuid,uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.takeover_list_members(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.takeover_save_answer(uuid,text,text,jsonb,integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.takeover_submit(uuid,text) FROM anon;

CREATE POLICY "takeover evidence read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'takeover-evidence'
         AND public.takeover_can_read(NULLIF(split_part(name, '/', 1), '')::uuid));

CREATE POLICY "takeover evidence upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'takeover-evidence'
         AND public.takeover_can_edit(NULLIF(split_part(name, '/', 1), '')::uuid));
