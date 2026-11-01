ALTER TABLE public.monetization_settings
  ADD COLUMN IF NOT EXISTS market_ship_listing_credits integer NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS market_spare_listing_credits integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS market_service_listing_credits integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS market_vendor_welcome_credits integer NOT NULL DEFAULT 500;

ALTER TABLE public.marketplace_items
  ADD COLUMN IF NOT EXISTS specifications jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS photos text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS documents text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.ship_listings
  ADD COLUMN IF NOT EXISTS specifications jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS documents text[] NOT NULL DEFAULT '{}';

-- Vendor welcome grant is once per account.
CREATE UNIQUE INDEX IF NOT EXISTS uq_credit_ledger_vendor_welcome
  ON public.credit_ledger (manager_user_id, reason) WHERE reason = 'vendor_welcome';

CREATE OR REPLACE FUNCTION public.grant_vendor_welcome() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v int;
BEGIN
  SELECT market_vendor_welcome_credits INTO v FROM monetization_settings WHERE id=true;
  v := coalesce(v,500);
  IF v > 0 THEN
    INSERT INTO credit_ledger(manager_user_id,delta,reason) VALUES (NEW.user_id, v, 'vendor_welcome')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_vendor_welcome ON public.marketplace_vendors;
CREATE TRIGGER trg_vendor_welcome AFTER INSERT ON public.marketplace_vendors
  FOR EACH ROW EXECUTE FUNCTION public.grant_vendor_welcome();

INSERT INTO public.credit_ledger(manager_user_id,delta,reason)
SELECT user_id, 500, 'vendor_welcome' FROM public.marketplace_vendors
ON CONFLICT DO NOTHING;

-- Listing fee: debited atomically at insert; admin exempt; 0 = free.
CREATE OR REPLACE FUNCTION public.charge_market_listing() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid := auth.uid(); v_cost int; v_bal int; s record;
BEGIN
  IF uid IS NULL OR public.is_admin(uid) THEN RETURN NEW; END IF;
  SELECT * INTO s FROM monetization_settings WHERE id=true;
  IF TG_TABLE_NAME = 'ship_listings' THEN v_cost := coalesce(s.market_ship_listing_credits,25);
  ELSIF NEW.category = 'yards' THEN v_cost := coalesce(s.market_service_listing_credits,10);
  ELSE v_cost := coalesce(s.market_spare_listing_credits,5); END IF;
  IF v_cost <= 0 THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('credits:'||uid::text));
  SELECT coalesce(sum(delta),0) INTO v_bal FROM credit_ledger WHERE manager_user_id=uid;
  IF v_bal < v_cost THEN
    RAISE EXCEPTION 'INSUFFICIENT_CREDITS: need %, have %', v_cost, v_bal USING ERRCODE='P0001';
  END IF;
  INSERT INTO credit_ledger(manager_user_id,delta,reason)
  VALUES (uid, -v_cost, 'market_list:'||TG_TABLE_NAME||':'||NEW.id);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_charge_market_item ON public.marketplace_items;
CREATE TRIGGER trg_charge_market_item BEFORE INSERT ON public.marketplace_items
  FOR EACH ROW EXECUTE FUNCTION public.charge_market_listing();
DROP TRIGGER IF EXISTS trg_charge_ship_listing ON public.ship_listings;
CREATE TRIGGER trg_charge_ship_listing BEFORE INSERT ON public.ship_listings
  FOR EACH ROW EXECUTE FUNCTION public.charge_market_listing();

-- Free credit requests (manual admin review during launch).
CREATE TABLE public.market_credit_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  requested integer NOT NULL CHECK (requested BETWEEN 1 AND 5000),
  reason text NOT NULL CHECK (length(reason) BETWEEN 5 AND 600),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined')),
  granted integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);
GRANT SELECT ON public.market_credit_requests TO authenticated;
GRANT ALL ON public.market_credit_requests TO service_role;
ALTER TABLE public.market_credit_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY mcr_read ON public.market_credit_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.request_market_credits(p_amount int, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not_signed_in'); END IF;
  IF NOT EXISTS (SELECT 1 FROM marketplace_vendors WHERE user_id=uid) THEN RETURN jsonb_build_object('ok',false,'error','not_vendor'); END IF;
  IF p_amount IS NULL OR p_amount < 1 OR p_amount > 5000 THEN RETURN jsonb_build_object('ok',false,'error','bad_amount'); END IF;
  IF length(coalesce(trim(p_reason),'')) < 5 THEN RETURN jsonb_build_object('ok',false,'error','reason'); END IF;
  IF EXISTS (SELECT 1 FROM market_credit_requests WHERE user_id=uid AND status='pending') THEN
    RETURN jsonb_build_object('ok',false,'error','pending_exists'); END IF;
  INSERT INTO market_credit_requests(user_id,requested,reason) VALUES (uid,p_amount,left(trim(p_reason),600));
  RETURN jsonb_build_object('ok',true);
END $$;
REVOKE ALL ON FUNCTION public.request_market_credits(int,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.request_market_credits(int,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_decide_credit_request(p_id uuid, p_approve boolean, p_amount int DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record; v int;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RETURN jsonb_build_object('ok',false,'error','forbidden'); END IF;
  SELECT * INTO r FROM market_credit_requests WHERE id=p_id AND status='pending' FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','not_pending'); END IF;
  IF p_approve THEN
    v := least(greatest(coalesce(p_amount, r.requested),1),5000);
    INSERT INTO credit_ledger(manager_user_id,delta,reason) VALUES (r.user_id, v, 'market_request:'||r.id);
    UPDATE market_credit_requests SET status='approved', granted=v, decided_at=now() WHERE id=p_id;
    INSERT INTO notifications(crew_id,kind,title,body,icon,screen)
    VALUES (r.user_id,'credits','Credits added',v||' free credits were added to your supplier wallet.','🎁','home');
  ELSE
    UPDATE market_credit_requests SET status='declined', decided_at=now() WHERE id=p_id;
  END IF;
  RETURN jsonb_build_object('ok',true);
END $$;
REVOKE ALL ON FUNCTION public.admin_decide_credit_request(uuid,boolean,int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_decide_credit_request(uuid,boolean,int) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_market_wallet() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
SELECT jsonb_build_object(
  'balance', (SELECT coalesce(sum(delta),0) FROM credit_ledger WHERE manager_user_id=auth.uid()),
  'ship', coalesce(s.market_ship_listing_credits,25),
  'spare', coalesce(s.market_spare_listing_credits,5),
  'service', coalesce(s.market_service_listing_credits,10),
  'welcome', coalesce(s.market_vendor_welcome_credits,500),
  'pending', EXISTS (SELECT 1 FROM market_credit_requests WHERE user_id=auth.uid() AND status='pending'))
FROM (SELECT 1) x LEFT JOIN monetization_settings s ON s.id=true;
$$;
REVOKE ALL ON FUNCTION public.get_my_market_wallet() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_market_wallet() TO authenticated;

NOTIFY pgrst, 'reload schema';