CREATE OR REPLACE FUNCTION public.get_my_applications()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(x ORDER BY x.created_at DESC), '[]'::jsonb)
  FROM (
    SELECT
      ja.id,
      ja.company_name,
      ja.rank_applied,
      ja.vessel_type,
      ja.outcome,
      ja.created_at,
      ja.created_at AS applied_at,
      ja.offer_details,
      ja.job_posting_id,
      ja.vacancy_id,
      CASE WHEN ja.job_posting_id IS NOT NULL
        THEN NULLIF(TRIM(COALESCE(jp.rank_required, '') || ' — ' || COALESCE(jp.vessel_type, '')), '—')
        ELSE NULL END AS vacancy_label
    FROM public.job_applications ja
    LEFT JOIN public.job_postings jp ON jp.id = ja.job_posting_id
    WHERE ja.crew_id = auth.uid()
  ) x;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_applications() TO authenticated;

CREATE OR REPLACE FUNCTION public.withdraw_application(p_application_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_outcome text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  SELECT outcome INTO v_outcome
  FROM public.job_applications
  WHERE id = p_application_id AND crew_id = auth.uid();

  IF v_outcome IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_outcome NOT IN ('awaiting', 'shortlisted') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_withdrawable', 'outcome', v_outcome);
  END IF;

  UPDATE public.job_applications
  SET outcome = 'withdrawn'
  WHERE id = p_application_id AND crew_id = auth.uid();

  RETURN jsonb_build_object('ok', true, 'outcome', 'withdrawn');
END;
$$;

GRANT EXECUTE ON FUNCTION public.withdraw_application(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';