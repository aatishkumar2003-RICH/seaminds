CREATE TABLE IF NOT EXISTS public.interview_matrix (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department text NOT NULL,
  rank_group text NOT NULL,
  experience_tier text NOT NULL,
  vessel_type text,
  topics jsonb NOT NULL DEFAULT '[]',
  scenario_weight int NOT NULL DEFAULT 40,
  technical_weight int NOT NULL DEFAULT 60,
  senior_mode boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (department, rank_group, experience_tier, vessel_type)
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_matrix_all_vessels
  ON public.interview_matrix (department, rank_group, experience_tier)
  WHERE vessel_type IS NULL;

GRANT SELECT ON public.interview_matrix TO authenticated;
GRANT ALL ON public.interview_matrix TO service_role;

ALTER TABLE public.interview_matrix ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_matrix" ON public.interview_matrix;
CREATE POLICY "authenticated_read_matrix" ON public.interview_matrix FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_manages_matrix" ON public.interview_matrix;
CREATE POLICY "admin_manages_matrix" ON public.interview_matrix FOR ALL TO authenticated
  USING (auth.uid() = '492ee966-e015-4440-a415-6ad6275a4a9b'::uuid)
  WITH CHECK (auth.uid() = '492ee966-e015-4440-a415-6ad6275a4a9b'::uuid);