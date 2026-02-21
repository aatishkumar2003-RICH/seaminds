
ALTER TABLE public.crew_profiles
  ADD COLUMN gender text,
  ADD COLUMN nationality text NOT NULL DEFAULT '',
  ADD COLUMN whatsapp_number text NOT NULL DEFAULT '',
  ADD COLUMN years_at_sea text NOT NULL DEFAULT '';
