CREATE OR REPLACE FUNCTION public.create_crew_profile_on_signup()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_first text; v_last text; v_name text;
BEGIN
  BEGIN
    IF NEW.raw_user_meta_data ? 'company_name' THEN RETURN NEW; END IF;
    IF EXISTS (SELECT 1 FROM marketing_team WHERE lower(email) = lower(NEW.email)) THEN RETURN NEW; END IF;
    v_name  := COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', '');
    v_first := COALESCE(NULLIF(NEW.raw_user_meta_data->>'first_name',''), NULLIF(NEW.raw_user_meta_data->>'given_name',''),
      NULLIF(split_part(v_name, ' ', 1),''), initcap(split_part(NEW.email, '@', 1)), 'Seafarer');
    v_last  := COALESCE(NULLIF(NEW.raw_user_meta_data->>'last_name',''), NULLIF(NEW.raw_user_meta_data->>'family_name',''),
      NULLIF(regexp_replace(v_name, '^\S+\s*', ''), ''), '');
    INSERT INTO public.crew_profiles (id, first_name, last_name, role, ship_name, nationality, whatsapp_number, onboarding_complete)
    VALUES (NEW.id, v_first, v_last, COALESCE(NULLIF(NEW.raw_user_meta_data->>'rank',''), 'Seafarer'), 'Not on vessel',
      COALESCE(NEW.raw_user_meta_data->>'nationality',''), NULLIF(NEW.raw_user_meta_data->>'whatsapp',''),
      COALESCE((NEW.raw_user_meta_data ? 'crew_signup') AND COALESCE(NEW.raw_user_meta_data->>'first_name','') <> '', false))
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'create_crew_profile_on_signup failed for %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END $function$;

-- Backfill seafarer accounts that never got a profile
INSERT INTO public.crew_profiles (id, first_name, last_name, role, ship_name, nationality)
SELECT u.id,
  COALESCE(NULLIF(u.raw_user_meta_data->>'given_name',''), NULLIF(split_part(COALESCE(u.raw_user_meta_data->>'name',''),' ',1),''), initcap(split_part(u.email,'@',1)), 'Seafarer'),
  COALESCE(NULLIF(u.raw_user_meta_data->>'family_name',''), ''),
  'Seafarer', 'Not on vessel', ''
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.crew_profiles c WHERE c.id = u.id)
  AND NOT (COALESCE(u.raw_user_meta_data,'{}'::jsonb) ? 'company_name')
  AND NOT EXISTS (SELECT 1 FROM public.manager_profiles m WHERE m.user_id = u.id)
  AND NOT EXISTS (SELECT 1 FROM public.marketing_team t WHERE lower(t.email) = lower(u.email))
ON CONFLICT (id) DO NOTHING;

-- Codes resolve for any account (crew or manager)
CREATE OR REPLACE FUNCTION public.claim_referral(p_code text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_ref uuid; v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR p_code IS NULL OR length(trim(p_code)) <> 8 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_code');
  END IF;
  SELECT id INTO v_ref FROM auth.users
  WHERE upper(substr(replace(id::text,'-',''),1,8)) = upper(trim(p_code)) LIMIT 1;
  IF v_ref IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unknown_code'); END IF;
  IF v_ref = v_uid THEN RETURN jsonb_build_object('ok', false, 'reason', 'self_referral'); END IF;
  UPDATE public.crew_profiles SET referred_by = v_ref, referral_claimed_at = now()
  WHERE id = v_uid AND referred_by IS NULL;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'already_referred_or_not_crew'); END IF;
  RETURN jsonb_build_object('ok', true);
END $function$;

-- +1 credit to referrer only after the new seafarer completes their profile
CREATE OR REPLACE FUNCTION public.grant_referral_credits()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_email text; v_today int; v_name text;
BEGIN
  IF NEW.referred_by IS NULL OR NEW.referred_by = NEW.id OR COALESCE(NEW.is_test,false) THEN RETURN NEW; END IF;
  IF NOT (NEW.quick_profile_completed_at IS NOT NULL OR NEW.onboarding_complete
          OR (COALESCE(NEW.role,'Seafarer') <> 'Seafarer' AND COALESCE(NEW.nationality,'') <> '')) THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM credit_ledger WHERE manager_user_id = NEW.referred_by AND reason = 'referral_' || NEW.id::text) THEN
    RETURN NEW;
  END IF;
  SELECT lower(email) INTO v_email FROM auth.users WHERE id = NEW.id;
  IF v_email ~ '@(tempmail|temp-mail|10minutemail|yopmail|guerrillamail|mailinator|trashmail|sharklasers|getnada|dispostable)\.' THEN
    RETURN NEW;
  END IF;
  SELECT count(*) INTO v_today FROM credit_ledger
  WHERE manager_user_id = NEW.referred_by AND reason LIKE 'referral_%' AND reason <> 'referral_joined'
    AND created_at > now() - interval '24 hours';
  IF v_today >= 50 THEN RETURN NEW; END IF;
  INSERT INTO credit_ledger (manager_user_id, delta, reason)
  VALUES (NEW.referred_by, 1, 'referral_' || NEW.id::text) ON CONFLICT DO NOTHING;
  IF FOUND AND EXISTS (SELECT 1 FROM crew_profiles WHERE id = NEW.referred_by) THEN
    v_name := trim(COALESCE(NEW.first_name,'A seafarer'));
    BEGIN
      INSERT INTO notifications (crew_id, kind, title, body, icon, screen)
      VALUES (NEW.referred_by, 'referral_credit', '+1 credit added to your wallet',
        v_name || ' joined with your invite link and completed their profile. Thank you for growing the SeaMinds community.', '🎉', 'home');
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_grant_referral_credits ON public.crew_profiles;
CREATE TRIGGER trg_grant_referral_credits
AFTER UPDATE OF referred_by, quick_profile_completed_at, onboarding_complete, role, nationality ON public.crew_profiles
FOR EACH ROW EXECUTE FUNCTION public.grant_referral_credits();

CREATE OR REPLACE FUNCTION public.get_my_wallet()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
    'verified_referrals', (SELECT count(*) FROM credit_ledger WHERE manager_user_id = v_uid AND reason LIKE 'referral_%' AND reason <> 'referral_joined'),
    'referral_credits', coalesce((SELECT sum(delta) FROM credit_ledger WHERE manager_user_id = v_uid AND reason LIKE 'referral_%' AND reason <> 'referral_joined'),0),
    'recent', coalesce((SELECT jsonb_agg(x) FROM (SELECT delta, reason, created_at FROM credit_ledger
                 WHERE manager_user_id = v_uid ORDER BY created_at DESC LIMIT 8) x), '[]'::jsonb)
  );
END $function$;