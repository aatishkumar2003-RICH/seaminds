
-- Drop existing policies
DROP POLICY IF EXISTS "Users can insert own crew_profile" ON crew_profiles;
DROP POLICY IF EXISTS "Users can read own crew_profile" ON crew_profiles;
DROP POLICY IF EXISTS "Users can update own crew_profile" ON crew_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON crew_profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON crew_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON crew_profiles;

-- Allow users to insert their own profile on signup
CREATE POLICY "Users can insert own profile"
  ON crew_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Allow users to read their own profile
CREATE POLICY "Users can read own profile"
  ON crew_profiles FOR SELECT
  USING (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile"
  ON crew_profiles FOR UPDATE
  USING (auth.uid() = id);
