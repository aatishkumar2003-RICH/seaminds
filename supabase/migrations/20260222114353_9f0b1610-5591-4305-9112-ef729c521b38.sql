
-- Add last_name to crew_profiles
ALTER TABLE public.crew_profiles ADD COLUMN last_name text NOT NULL DEFAULT '';

-- Create manager_profiles table
CREATE TABLE public.manager_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  company_name text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.manager_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can read own profile"
ON public.manager_profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Managers can insert own profile"
ON public.manager_profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
