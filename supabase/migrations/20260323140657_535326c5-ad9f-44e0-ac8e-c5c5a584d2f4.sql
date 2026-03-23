
CREATE TABLE public.external_vacancies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL,
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  rank_required TEXT,
  vessel_type TEXT,
  company_name TEXT,
  salary_min INTEGER,
  salary_max INTEGER,
  salary_text TEXT,
  joining_port TEXT,
  joining_date TEXT,
  contract_duration TEXT,
  description TEXT,
  apply_url TEXT,
  contact_email TEXT,
  contact_whatsapp TEXT,
  quality_score INTEGER DEFAULT 50,
  is_verified BOOLEAN DEFAULT false,
  is_scam_flagged BOOLEAN DEFAULT false,
  scam_flags JSONB DEFAULT '[]'::jsonb,
  raw_data JSONB,
  fetched_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(source, external_id)
);

ALTER TABLE public.external_vacancies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read external_vacancies"
  ON public.external_vacancies FOR SELECT
  TO public
  USING (true);
