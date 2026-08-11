DROP POLICY IF EXISTS "Managers manage own posts" ON public.company_posts;

CREATE POLICY "Managers update own posts"
ON public.company_posts
FOR UPDATE
USING (manager_id = auth.uid())
WITH CHECK (manager_id = auth.uid());

CREATE POLICY "Managers delete own posts"
ON public.company_posts
FOR DELETE
USING (manager_id = auth.uid());