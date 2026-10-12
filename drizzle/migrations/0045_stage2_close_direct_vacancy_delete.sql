-- Stage 2 cutover: manual vacancy deletion must go through the audited
-- vacancy_lifecycle_action RPC (SECURITY DEFINER). Close the unaudited direct
-- browser DELETE path. service_role (scraper/edge functions) is unaffected.
REVOKE DELETE ON public.job_postings FROM anon, authenticated;
REVOKE DELETE ON public.external_vacancies FROM anon, authenticated;