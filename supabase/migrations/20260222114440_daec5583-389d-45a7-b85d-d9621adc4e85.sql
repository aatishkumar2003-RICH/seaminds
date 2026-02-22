
-- Allow authenticated users (managers) to read crew_profiles
-- This is needed because managers query crew from their company
-- The existing policy is permissive for anon, but we need authenticated too
CREATE POLICY "Authenticated can read crew_profiles"
ON public.crew_profiles
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated to read chat_messages for mood data
CREATE POLICY "Authenticated can read chat_messages"
ON public.chat_messages
FOR SELECT
TO authenticated
USING (true);
