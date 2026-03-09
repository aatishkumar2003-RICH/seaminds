
-- Drop all existing crew_profiles policies and recreate correctly
DROP POLICY IF EXISTS "Users can insert own profile" ON crew_profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON crew_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON crew_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON crew_profiles;
DROP POLICY IF EXISTS "Users can manage own profile" ON crew_profiles;
DROP POLICY IF EXISTS "crew_insert" ON crew_profiles;
DROP POLICY IF EXISTS "crew_select" ON crew_profiles;
DROP POLICY IF EXISTS "crew_update" ON crew_profiles;

-- crew_profiles has user_id column, use that
CREATE POLICY "crew_insert" ON crew_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "crew_select" ON crew_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "crew_update" ON crew_profiles FOR UPDATE USING (auth.uid() = user_id);
