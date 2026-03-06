
CREATE TABLE public.job_postings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rank_required TEXT NOT NULL,
  vessel_type TEXT NOT NULL,
  contract_duration TEXT NOT NULL,
  monthly_salary TEXT,
  joining_port TEXT NOT NULL,
  contact_whatsapp TEXT NOT NULL,
  company_name TEXT NOT NULL,
  additional_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.job_postings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert job_postings" ON public.job_postings FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read job_postings" ON public.job_postings FOR SELECT USING (true);
