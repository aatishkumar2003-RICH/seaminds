ALTER TABLE public.job_postings ADD COLUMN IF NOT EXISTS manager_id uuid;
CREATE INDEX IF NOT EXISTS idx_job_postings_manager ON public.job_postings(manager_id);