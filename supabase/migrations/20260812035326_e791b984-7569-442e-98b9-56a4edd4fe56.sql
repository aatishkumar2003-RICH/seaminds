CREATE TABLE IF NOT EXISTS public.company_fleet_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL,
  crew_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  source text NOT NULL DEFAULT 'manual',
  linked_at timestamptz,
  expires_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (manager_id, crew_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_fleet_links TO authenticated;
GRANT ALL ON public.company_fleet_links TO service_role;

ALTER TABLE public.company_fleet_links ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='company_fleet_links' AND policyname='Managers manage their own fleet links') THEN
    CREATE POLICY "Managers manage their own fleet links"
      ON public.company_fleet_links FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.manager_profiles mp WHERE mp.id = company_fleet_links.manager_id AND mp.user_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.manager_profiles mp WHERE mp.id = company_fleet_links.manager_id AND mp.user_id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='company_fleet_links' AND policyname='Crew can view their own fleet links') THEN
    CREATE POLICY "Crew can view their own fleet links"
      ON public.company_fleet_links FOR SELECT TO authenticated
      USING (crew_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='company_fleet_links' AND policyname='Crew can respond to their own fleet links') THEN
    CREATE POLICY "Crew can respond to their own fleet links"
      ON public.company_fleet_links FOR UPDATE TO authenticated
      USING (crew_id = auth.uid())
      WITH CHECK (crew_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='company_fleet_links' AND policyname='Admin manages fleet links') THEN
    CREATE POLICY "Admin manages fleet links"
      ON public.company_fleet_links FOR ALL TO authenticated
      USING (auth.uid() = '492ee966-e015-4440-a415-6ad6275a4a9b'::uuid)
      WITH CHECK (auth.uid() = '492ee966-e015-4440-a415-6ad6275a4a9b'::uuid);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_company_fleet_links_manager ON public.company_fleet_links(manager_id);
CREATE INDEX IF NOT EXISTS idx_company_fleet_links_crew ON public.company_fleet_links(crew_id);

ALTER TABLE public.manager_profiles
  ADD COLUMN IF NOT EXISTS fleet_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fleet_until date;