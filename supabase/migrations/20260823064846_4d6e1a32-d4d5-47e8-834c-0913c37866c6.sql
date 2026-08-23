ALTER TABLE public.job_applications ADD COLUMN IF NOT EXISTS job_posting_id uuid;
CREATE INDEX IF NOT EXISTS idx_job_applications_posting ON public.job_applications(job_posting_id);