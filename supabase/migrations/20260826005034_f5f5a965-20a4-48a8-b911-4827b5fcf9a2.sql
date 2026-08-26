ALTER TABLE public.job_postings ADD COLUMN IF NOT EXISTS contact_email text;
NOTIFY pgrst,'reload schema';