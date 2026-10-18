-- Founder Launch credits: idempotent welcome grant + referral bonuses on the shared credit_ledger.
CREATE UNIQUE INDEX IF NOT EXISTS uq_credit_ledger_once
  ON public.credit_ledger (manager_user_id, reason)
  WHERE reason = 'welcome_launch' OR reason LIKE 'referral_%';

CREATE OR REPLACE FUNCTION public.get_my_wallet()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); v_code text;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;
  v_code := upper(substr(replace(v_uid::text, '-', ''), 1, 8));
  RETURN jsonb_build_object(
    'ok', true,
    'balance', coalesce((SELECT sum(delta) FROM credit_ledger WHERE manager_user_id = v_uid), 0),
    'welcome_claimed', EXISTS (SELECT 1 FROM credit_ledger WHERE manager_user_id = v_uid AND reason = 'welcome_launch'),
    'code', v_code,
    'link', 'https://seaminds.life/?ref=' || v_code,
    'referrals', (SELECT count(*) FROM crew_profiles WHERE referred_by = v_uid),
    'recent', coalesce((SELECT jsonb_agg(x) FROM (SELECT delta, reason, created_at FROM credit_ledger
                 WHERE manager_user_id = v_uid ORDER BY created_at DESC LIMIT 8) x), '[]'::jsonb)
  );
END $$;

CREATE OR REPLACE FUNCTION public.claim_welcome_credits()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid uuid := auth.uid(); n int;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;
  INSERT INTO credit_ledger (manager_user_id, delta, reason)
  VALUES (v_uid, 50, 'welcome_launch') ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'granted', n > 0);
END $$;

CREATE OR REPLACE FUNCTION public.grant_referral_credits()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.referred_by IS NOT NULL AND OLD.referred_by IS NULL AND NEW.referred_by <> NEW.id THEN
    INSERT INTO credit_ledger (manager_user_id, delta, reason)
    VALUES (NEW.id, 10, 'referral_joined') ON CONFLICT DO NOTHING;
    INSERT INTO credit_ledger (manager_user_id, delta, reason)
    VALUES (NEW.referred_by, 5, 'referral_' || NEW.id::text) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_grant_referral_credits ON public.crew_profiles;
CREATE TRIGGER trg_grant_referral_credits AFTER UPDATE OF referred_by ON public.crew_profiles
  FOR EACH ROW EXECUTE FUNCTION public.grant_referral_credits();

REVOKE ALL ON FUNCTION public.get_my_wallet() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_welcome_credits() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.grant_referral_credits() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_wallet() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_welcome_credits() TO authenticated;
NOTIFY pgrst, 'reload schema';