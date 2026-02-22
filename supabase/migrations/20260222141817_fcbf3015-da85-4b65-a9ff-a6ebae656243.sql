
-- Crew availability profiles
CREATE TABLE public.crew_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_profile_id uuid NOT NULL REFERENCES public.crew_profiles(id) ON DELETE CASCADE,
  availability_date date,
  preferred_vessel_type text DEFAULT 'Any Type',
  about_me text DEFAULT '',
  visible_to_employers boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(crew_profile_id)
);

ALTER TABLE public.crew_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert crew_availability" ON public.crew_availability FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read crew_availability" ON public.crew_availability FOR SELECT USING (true);
CREATE POLICY "Anyone can update crew_availability" ON public.crew_availability FOR UPDATE USING (true) WITH CHECK (true);

-- Job vacancies posted by managers
CREATE TABLE public.job_vacancies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_profile_id uuid NOT NULL REFERENCES public.manager_profiles(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  vessel_name text NOT NULL,
  vessel_type text NOT NULL,
  rank_required text NOT NULL,
  contract_duration text NOT NULL,
  start_date date NOT NULL,
  joining_port text NOT NULL,
  salary_min integer NOT NULL DEFAULT 0,
  salary_max integer NOT NULL DEFAULT 0,
  special_requirements text DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.job_vacancies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active vacancies" ON public.job_vacancies FOR SELECT USING (true);
CREATE POLICY "Managers can insert vacancies" ON public.job_vacancies FOR INSERT WITH CHECK (true);
CREATE POLICY "Managers can update vacancies" ON public.job_vacancies FOR UPDATE USING (true) WITH CHECK (true);

-- Contact requests between managers and crew
CREATE TABLE public.contact_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vacancy_id uuid REFERENCES public.job_vacancies(id) ON DELETE CASCADE,
  crew_profile_id uuid NOT NULL REFERENCES public.crew_profiles(id) ON DELETE CASCADE,
  manager_profile_id uuid NOT NULL REFERENCES public.manager_profiles(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  vessel_type text NOT NULL,
  rank_required text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert contact_requests" ON public.contact_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read contact_requests" ON public.contact_requests FOR SELECT USING (true);
CREATE POLICY "Anyone can update contact_requests" ON public.contact_requests FOR UPDATE USING (true) WITH CHECK (true);
