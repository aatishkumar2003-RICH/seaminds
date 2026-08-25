ALTER TABLE public.crew_profiles ADD COLUMN IF NOT EXISTS public_card_token text UNIQUE DEFAULT encode(gen_random_bytes(6),'hex');

UPDATE public.crew_profiles SET public_card_token = encode(gen_random_bytes(6),'hex') WHERE public_card_token IS NULL;

CREATE OR REPLACE FUNCTION public.get_crew_card(p_token text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT jsonb_build_object(
      'first_name', cp.first_name,
      'last_initial', left(coalesce(cp.last_name,''),1),
      'role', coalesce(cp.rank, cp.role),
      'nationality', cp.nationality,
      'years_in_rank_band', cp.years_in_rank_band,
      'contracts_in_rank_band', cp.contracts_in_rank_band,
      'total_sea_service_band', cp.total_sea_service_band,
      'is_available', coalesce(cp.is_available, false),
      'vessel_families', coalesce((
        SELECT jsonb_agg(jsonb_build_object('vessel_family', ve.vessel_family, 'sea_time_band', ve.sea_time_band))
        FROM public.crew_vessel_experience ve WHERE ve.crew_id = cp.id), '[]'::jsonb),
      'score', (
        SELECT jsonb_build_object(
          'overall_score', sa.overall_score,
          'score_band', sa.score_band,
          'certificate_id', sa.certificate_id,
          'completed_at', sa.completed_at)
        FROM public.smc_assessments sa
        WHERE sa.crew_profile_id = cp.id AND sa.status = 'completed'
        ORDER BY sa.completed_at DESC NULLS LAST
        LIMIT 1),
      'claims', coalesce((
        SELECT jsonb_agg(jsonb_build_object('claim_key', cc.claim_key, 'status', cc.status))
        FROM public.crew_claims cc WHERE cc.crew_id = cp.id), '[]'::jsonb)
    )
    FROM public.crew_profiles cp
    WHERE cp.public_card_token = p_token
    LIMIT 1),
  '{}'::jsonb);
$$;

GRANT EXECUTE ON FUNCTION public.get_crew_card(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';