CREATE OR REPLACE FUNCTION public.campaign_training_summary(p_campaign_id uuid)
RETURNS TABLE(invite_id uuid, assigned integer, completed integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM interview_campaigns c WHERE c.id = p_campaign_id AND (c.manager_id = auth.uid() OR is_admin(auth.uid()))) THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT i.id,
    count(a.id) FILTER (WHERE a.status = 'completed' OR a.assigned_by = auth.uid() OR is_admin(auth.uid()))::int,
    count(a.id) FILTER (WHERE a.status = 'completed')::int
  FROM interview_invites i
  LEFT JOIN crew_training_assignments a ON a.crew_id = i.crew_profile_id
  WHERE i.campaign_id = p_campaign_id AND i.crew_profile_id IS NOT NULL
  GROUP BY i.id;
END $$;
REVOKE ALL ON FUNCTION public.campaign_training_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.campaign_training_summary(uuid) TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';