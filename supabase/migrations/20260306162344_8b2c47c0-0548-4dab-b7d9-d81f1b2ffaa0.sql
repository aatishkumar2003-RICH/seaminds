-- Create crew_documents table for tracking uploaded documents
CREATE TABLE public.crew_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_profile_id UUID NOT NULL,
  category TEXT NOT NULL,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.crew_documents ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can insert crew_documents"
ON public.crew_documents FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can read crew_documents"
ON public.crew_documents FOR SELECT USING (true);

CREATE POLICY "Anyone can delete crew_documents"
ON public.crew_documents FOR DELETE USING (true);

-- Create crew-documents storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('crew-documents', 'crew-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Anyone can upload crew documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'crew-documents');

CREATE POLICY "Anyone can read crew documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'crew-documents');

CREATE POLICY "Anyone can delete crew documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'crew-documents');