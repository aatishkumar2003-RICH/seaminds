ALTER TABLE public.crew_profiles ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.crew_profiles ADD COLUMN IF NOT EXISTS email text;
CREATE UNIQUE INDEX IF NOT EXISTS crew_profiles_user_id_idx ON public.crew_profiles(user_id);