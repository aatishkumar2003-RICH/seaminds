UPDATE public.job_postings
SET expires_at = created_at + interval '14 days'
WHERE posting_batch_id IS NULL
  AND source_type IS NULL
  AND expires_at IS DISTINCT FROM (created_at + interval '14 days');