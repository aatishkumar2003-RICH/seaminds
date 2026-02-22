
-- Create smc_assessments table
CREATE TABLE public.smc_assessments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  crew_profile_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress',
  current_step INTEGER NOT NULL DEFAULT 1,
  doc_upload_status TEXT NOT NULL DEFAULT 'pending',
  technical_score NUMERIC,
  english_score NUMERIC,
  experience_score NUMERIC,
  behavioural_score NUMERIC,
  wellness_score NUMERIC,
  overall_score NUMERIC,
  score_band TEXT,
  certificate_id TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- RLS
ALTER TABLE public.smc_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert smc_assessments" ON public.smc_assessments FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read smc_assessments" ON public.smc_assessments FOR SELECT USING (true);
CREATE POLICY "Anyone can update smc_assessments" ON public.smc_assessments FOR UPDATE USING (true) WITH CHECK (true);

-- Storage bucket for document uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('smc-documents', 'smc-documents', false);

-- Storage RLS policies
CREATE POLICY "Anyone can upload smc documents" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'smc-documents');
CREATE POLICY "Anyone can read own smc documents" ON storage.objects FOR SELECT USING (bucket_id = 'smc-documents');
