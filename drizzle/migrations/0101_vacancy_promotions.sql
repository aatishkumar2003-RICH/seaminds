CREATE TABLE public.vacancy_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  posting_id uuid NOT NULL,
  manager_id uuid NOT NULL,
  campaign text NOT NULL CHECK (campaign IN ('urgent','fleet')),
  batch_id uuid NOT NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX vacancy_promotions_active_idx ON public.vacancy_promotions (ends_at);
GRANT SELECT ON public.vacancy_promotions TO authenticated;
GRANT ALL ON public.vacancy_promotions TO service_role;
ALTER TABLE public.vacancy_promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "managers_read_own_promotions" ON public.vacancy_promotions FOR SELECT TO authenticated USING (manager_id = auth.uid());

-- Pricing: urgent (48h) = 5 credits per 5 vacancies; fleet (7 days) = 5 credits per 10 vacancies.
CREATE OR REPLACE FUNCTION public.promote_vacancies(p_ids uuid[], p_campaign text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ids uuid[];
  v_n int;
  v_cost int;
  v_bal int;
  v_batch uuid := gen_random_uuid();
  v_hours int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Please sign in'; END IF;
  IF p_campaign NOT IN ('urgent','fleet') THEN RAISE EXCEPTION 'Unknown campaign'; END IF;
  SELECT array_agg(DISTINCT j.id) INTO v_ids FROM public.job_postings j
   WHERE j.id = ANY(p_ids) AND j.manager_id = v_uid AND j.status = 'active'
     AND NOT EXISTS (SELECT 1 FROM public.vacancy_promotions p WHERE p.posting_id = j.id AND p.ends_at > now());
  v_n := coalesce(array_length(v_ids,1),0);
  IF v_n = 0 THEN RAISE EXCEPTION 'No eligible vacancies (already promoted or not yours)'; END IF;
  IF v_n > 100 THEN RAISE EXCEPTION 'Maximum 100 vacancies per promotion'; END IF;
  IF p_campaign = 'urgent' THEN v_cost := 5 * ceil(v_n/5.0)::int; v_hours := 48;
  ELSE v_cost := 5 * ceil(v_n/10.0)::int; v_hours := 168; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('credits:' || v_uid::text));
  SELECT coalesce(sum(delta),0) INTO v_bal FROM public.credit_ledger WHERE manager_user_id = v_uid;
  IF v_bal < v_cost THEN RAISE EXCEPTION 'Not enough credits: need %, you have %', v_cost, v_bal; END IF;
  INSERT INTO public.credit_ledger (manager_user_id, delta, reason)
  VALUES (v_uid, -v_cost, 'promotion:' || p_campaign || ':' || v_batch::text);
  INSERT INTO public.vacancy_promotions (posting_id, manager_id, campaign, batch_id, ends_at)
  SELECT x, v_uid, p_campaign, v_batch, now() + make_interval(hours => v_hours) FROM unnest(v_ids) x;
  RETURN jsonb_build_object('promoted', v_n, 'credits', v_cost, 'balance', v_bal - v_cost);
END $$;
REVOKE ALL ON FUNCTION public.promote_vacancies(uuid[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.promote_vacancies(uuid[], text) TO authenticated;

-- Public sponsored list in fair rotation: order reshuffles every 3 hours, urgent first.
CREATE OR REPLACE FUNCTION public.sponsored_vacancies()
RETURNS TABLE (posting_id uuid, campaign text, rank_required text, vessel_type text, company_name text, recruiter_name text, joining_port text, monthly_salary text, manager_id uuid, ends_at timestamptz, rotation int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.posting_id, p.campaign, j.rank_required, j.vessel_type, j.company_name, j.recruiter_name, j.joining_port, j.monthly_salary, p.manager_id, p.ends_at,
    (row_number() OVER (ORDER BY (p.campaign = 'urgent') DESC, md5(p.posting_id::text || floor(extract(epoch from now())/10800)::text)))::int
  FROM public.vacancy_promotions p JOIN public.job_postings j ON j.id = p.posting_id
  WHERE p.ends_at > now() AND p.starts_at <= now() AND j.status = 'active'
  LIMIT 500
$$;
GRANT EXECUTE ON FUNCTION public.sponsored_vacancies() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.vacancy_market_stats()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'active', (SELECT count(*) FROM job_postings WHERE status='active'),
    'companies', (SELECT count(DISTINCT lower(coalesce(nullif(recruiter_name,''), company_name))) FROM job_postings WHERE status='active'),
    'new24h', (SELECT count(*) FROM job_postings WHERE status='active' AND created_at > now() - interval '24 hours'),
    'promoted', (SELECT count(*) FROM vacancy_promotions WHERE ends_at > now()))
$$;
GRANT EXECUTE ON FUNCTION public.vacancy_market_stats() TO authenticated;