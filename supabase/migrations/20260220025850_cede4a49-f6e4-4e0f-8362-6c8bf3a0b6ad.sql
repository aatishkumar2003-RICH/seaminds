
-- Crew profiles table
CREATE TABLE public.crew_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name TEXT NOT NULL,
  ship_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Captain', 'Officer', 'Rating', 'Engineer')),
  onboarded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Chat messages table
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  crew_profile_id UUID NOT NULL REFERENCES public.crew_profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('assistant', 'user')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- No RLS needed - this is an anonymous app without auth
ALTER TABLE public.crew_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Public access policies (no auth in this app)
CREATE POLICY "Allow all access to crew_profiles" ON public.crew_profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to chat_messages" ON public.chat_messages FOR ALL USING (true) WITH CHECK (true);

-- Index for fast message retrieval
CREATE INDEX idx_chat_messages_crew_profile ON public.chat_messages(crew_profile_id, created_at);
