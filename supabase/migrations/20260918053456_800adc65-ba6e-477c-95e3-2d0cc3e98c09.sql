
CREATE OR REPLACE FUNCTION public.takeover_member_role(_inspection_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.role FROM public.takeover_members m
   WHERE m.inspection_id = _inspection_id AND m.user_id = auth.uid()
   LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.takeover_member_role(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.takeover_member_role(uuid) TO authenticated;

DROP POLICY "takeover read own or member" ON public.takeover_inspections;
CREATE POLICY "takeover read own or member" ON public.takeover_inspections
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid()
         OR public.is_admin(auth.uid())
         OR public.takeover_member_role(id) IS NOT NULL);

DROP POLICY "takeover update draft by editors" ON public.takeover_inspections;
CREATE POLICY "takeover update draft by editors" ON public.takeover_inspections
  FOR UPDATE TO authenticated
  USING (status = 'draft' AND (owner_id = auth.uid() OR public.takeover_member_role(id) = 'inspector'))
  WITH CHECK (status = 'draft');

DROP FUNCTION IF EXISTS public.zz_takeover_fixture_check();
DROP FUNCTION IF EXISTS public.zz_takeover_fixture_check2();
