CREATE TABLE IF NOT EXISTS public.referral_codes (
  code text PRIMARY KEY CHECK (code ~ '^[A-Z0-9]{3,16}$'),
  owner_name text NOT NULL,
  owner_contact text,
  channel text,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL REFERENCES public.referral_codes(code),
  crew_id uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.referral_codes TO service_role;
GRANT ALL ON public.referrals TO service_role;

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.record_referral(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_code text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_signed_in');
  END IF;
  v_code := upper(trim(coalesce(p_code, '')));
  IF NOT EXISTS (SELECT 1 FROM public.referral_codes rc WHERE rc.code = v_code AND rc.active) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unknown_code');
  END IF;
  INSERT INTO public.referrals (code, crew_id) VALUES (v_code, auth.uid())
  ON CONFLICT (crew_id) DO NOTHING;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.record_referral(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_referral(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_referral_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN NOT public.is_admin(auth.uid()) THEN '[]'::jsonb
  ELSE coalesce((
    SELECT jsonb_agg(x ORDER BY x->>'code')
    FROM (
      SELECT jsonb_build_object(
        'code', rc.code,
        'owner_name', rc.owner_name,
        'channel', rc.channel,
        'active', rc.active,
        'signups', count(r.id),
        'qualified', count(*) FILTER (WHERE cp.quick_profile_completed_at IS NOT NULL),
        'visible', count(*) FILTER (WHERE cp.is_available),
        'last_signup_at', max(r.created_at)
      ) AS x
      FROM public.referral_codes rc
      LEFT JOIN public.referrals r ON r.code = rc.code
      LEFT JOIN public.crew_profiles cp ON cp.id = r.crew_id
      GROUP BY rc.code, rc.owner_name, rc.channel, rc.active
    ) s
  ), '[]'::jsonb) END;
$$;

REVOKE ALL ON FUNCTION public.get_referral_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_referral_stats() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_upsert_referral_code(p_code text, p_owner text, p_contact text, p_channel text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_code text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_admin');
  END IF;
  v_code := upper(trim(coalesce(p_code, '')));
  IF v_code !~ '^[A-Z0-9]{3,16}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bad_code');
  END IF;
  INSERT INTO public.referral_codes (code, owner_name, owner_contact, channel)
  VALUES (v_code, coalesce(nullif(trim(coalesce(p_owner,'')), ''), v_code), nullif(trim(coalesce(p_contact,'')),''), nullif(trim(coalesce(p_channel,'')),''))
  ON CONFLICT (code) DO UPDATE SET
    owner_name = excluded.owner_name,
    owner_contact = excluded.owner_contact,
    channel = excluded.channel,
    active = true;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_upsert_referral_code(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_upsert_referral_code(text, text, text, text) TO authenticated;

INSERT INTO public.referral_codes (code, owner_name, channel)
VALUES ('CAPTAIN', 'Atish test', 'internal')
ON CONFLICT (code) DO NOTHING;

NOTIFY pgrst, 'reload schema';