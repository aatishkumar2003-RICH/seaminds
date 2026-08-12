CREATE OR REPLACE FUNCTION public.get_my_referral_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_count int;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;
  v_code := upper(substr(replace(auth.uid()::text, '-', ''), 1, 8));
  SELECT count(*) INTO v_count FROM public.crew_profiles WHERE referred_by = auth.uid();
  RETURN jsonb_build_object(
    'ok', true,
    'code', v_code,
    'link', 'https://seaminds.life/?ref=' || v_code,
    'shipmates_aboard', coalesce(v_count, 0)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_referral_stats() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_referral_stats() TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_referral(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref uuid;
BEGIN
  IF auth.uid() IS NULL OR p_code IS NULL OR length(p_code) < 6 THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  SELECT id INTO v_ref
  FROM public.crew_profiles
  WHERE upper(substr(replace(id::text, '-', ''), 1, 8)) = upper(p_code)
  LIMIT 1;

  IF v_ref IS NULL OR v_ref = auth.uid() THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  UPDATE public.crew_profiles
  SET referred_by = v_ref, referral_claimed_at = now()
  WHERE id = auth.uid() AND referred_by IS NULL;

  RETURN jsonb_build_object('ok', found);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_referral(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_referral(text) TO authenticated;