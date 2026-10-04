ALTER TABLE public.fleet_staff_members
  ADD COLUMN IF NOT EXISTS staff_code text,
  ADD COLUMN IF NOT EXISTS modules text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS provisioned_by_admin boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS fleet_staff_members_staff_code_key ON public.fleet_staff_members (lower(staff_code)) WHERE staff_code IS NOT NULL;