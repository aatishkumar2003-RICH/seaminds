ALTER TABLE public.crew_availability ADD CONSTRAINT crew_availability_profile_unique UNIQUE (crew_profile_id);
NOTIFY pgrst, 'reload schema';