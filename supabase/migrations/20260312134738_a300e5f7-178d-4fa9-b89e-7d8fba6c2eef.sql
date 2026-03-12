-- Backfill user_id only for profiles whose id exists in auth.users
UPDATE crew_profiles 
SET user_id = id 
WHERE user_id IS NULL 
  AND id IN (SELECT id FROM auth.users);