ALTER TABLE public.fleet_staff_members
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS approval_limit_usd numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS can_approve_salaries boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_approve_travel boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_approve_permits boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_approve_staff boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cell_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS vessel_ids uuid[] NOT NULL DEFAULT '{}';
NOTIFY pgrst, 'reload schema';