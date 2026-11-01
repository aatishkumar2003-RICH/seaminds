CREATE TABLE public.marketplace_vendors (
  user_id uuid PRIMARY KEY,
  company_name text NOT NULL CHECK (length(trim(company_name)) BETWEEN 2 AND 120),
  vendor_type text NOT NULL DEFAULT 'spares_supplier' CHECK (vendor_type IN ('spares_supplier','shipyard_workshop','ship_broker','tech_stores')),
  contact_name text,
  contact_email text,
  whatsapp text,
  city text,
  country text,
  website text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.marketplace_vendors TO authenticated;
GRANT ALL ON public.marketplace_vendors TO service_role;
ALTER TABLE public.marketplace_vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY mv_read ON public.marketplace_vendors FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY mv_insert ON public.marketplace_vendors FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND status = 'pending');
CREATE POLICY mv_update ON public.marketplace_vendors FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid())) WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- Only admins change vendor status.
CREATE OR REPLACE FUNCTION public.marketplace_vendor_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT public.is_admin(auth.uid()) THEN NEW.status := OLD.status; END IF;
  NEW.user_id := OLD.user_id; NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_marketplace_vendor_guard BEFORE UPDATE ON public.marketplace_vendors FOR EACH ROW EXECUTE FUNCTION public.marketplace_vendor_guard();

-- Owner switch to open browsing for everyone (admin_settings key marketplace_open = 'true').
CREATE OR REPLACE FUNCTION public.marketplace_is_open() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT value = 'true' FROM public.admin_settings WHERE key = 'marketplace_open' LIMIT 1), false);
$$;
GRANT EXECUTE ON FUNCTION public.marketplace_is_open() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_marketplace_vendor(_uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.marketplace_vendors WHERE user_id = _uid AND status <> 'suspended');
$$;
GRANT EXECUTE ON FUNCTION public.is_marketplace_vendor(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_marketplace_seller(_uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin(_uid)
      OR public.is_marketplace_vendor(_uid)
      OR (public.is_approved_manager(_uid) AND EXISTS (SELECT 1 FROM public.marketplace_sellers WHERE user_id = _uid));
$$;

-- Private phase: sellers see only their own listings until the owner opens the exchange.
DROP POLICY IF EXISTS mi_read ON public.marketplace_items;
CREATE POLICY mi_read ON public.marketplace_items FOR SELECT TO authenticated
  USING (seller_id = auth.uid() OR public.is_admin(auth.uid()) OR (status = 'active' AND public.marketplace_is_open()));

-- Vendor sign-ups never become crew; they get a vendor row instead.
CREATE OR REPLACE FUNCTION public.create_crew_profile_on_signup()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_first text; v_last text; v_name text;
BEGIN
  BEGIN
    IF NEW.raw_user_meta_data ? 'company_name' THEN RETURN NEW; END IF;
    IF NEW.raw_user_meta_data ? 'vendor_signup' THEN RETURN NEW; END IF;
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

CREATE OR REPLACE FUNCTION public.create_vendor_on_signup() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m jsonb := NEW.raw_user_meta_data; v_type text;
BEGIN
  BEGIN
    IF m ? 'vendor_signup' AND coalesce(trim(m->>'vendor_company'),'') <> '' THEN
      v_type := CASE WHEN m->>'vendor_type' IN ('spares_supplier','shipyard_workshop','ship_broker','tech_stores') THEN m->>'vendor_type' ELSE 'spares_supplier' END;
      INSERT INTO public.marketplace_vendors(user_id, company_name, vendor_type, contact_name, contact_email, whatsapp, city, country)
      VALUES (NEW.id, left(trim(m->>'vendor_company'),120), v_type, left(m->>'full_name',100), NEW.email,
              left(m->>'whatsapp',30), left(m->>'city',80), left(m->>'country',80))
      ON CONFLICT (user_id) DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'create_vendor_on_signup failed for %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created_vendor AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.create_vendor_on_signup();

-- Buyer quote requests stay owner-only until the exchange is opened.
CREATE OR REPLACE FUNCTION public.marketplace_contact(p_item uuid, p_channel text, p_inquiry jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid:=auth.uid(); v_cost int; v_bal int; v_new boolean:=false; it record; c record;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not_signed_in'); END IF;
  IF uid<>'492ee966-e015-4440-a415-6ad6275a4a9b'::uuid AND NOT public.marketplace_is_open() THEN RETURN jsonb_build_object('ok',false,'error','owner_preview_only'); END IF;
  IF p_channel NOT IN ('online','whatsapp','email') THEN RETURN jsonb_build_object('ok',false,'error','bad_channel'); END IF;
  SELECT * INTO it FROM marketplace_items WHERE id=p_item AND status='active';
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','not_found'); END IF;
  IF it.is_sample THEN RETURN jsonb_build_object('ok',false,'error','sample'); END IF;
  IF it.seller_id = uid THEN RETURN jsonb_build_object('ok',false,'error','own_item'); END IF;
  IF (SELECT count(*) FROM marketplace_inquiries WHERE buyer_id=uid AND created_at > now()-interval '1 day') >= 30 THEN
    RETURN jsonb_build_object('ok',false,'error','rate_limited'); END IF;
  PERFORM pg_advisory_xact_lock(hashtext('credits:'||uid::text));
  SELECT CASE WHEN s.enabled THEN s.market_contact_credits ELSE 0 END INTO v_cost FROM monetization_settings s WHERE s.id=true;
  v_cost:=coalesce(v_cost,0);
  IF NOT EXISTS (SELECT 1 FROM marketplace_unlocks WHERE user_id=uid AND item_id=p_item) THEN
    SELECT coalesce(sum(delta),0) INTO v_bal FROM credit_ledger WHERE manager_user_id=uid;
    IF v_bal<v_cost THEN RETURN jsonb_build_object('ok',false,'error','no_credits','cost',v_cost); END IF;
    INSERT INTO marketplace_unlocks(user_id,item_id) VALUES(uid,p_item);
    IF v_cost>0 THEN INSERT INTO credit_ledger(manager_user_id,delta,reason) VALUES(uid,-v_cost,'market:'||p_item); END IF;
    v_new:=true;
  END IF;
  INSERT INTO marketplace_inquiries(item_id,buyer_id,vessel,imo,port,needed_by,quantity,notes,channel)
  VALUES(p_item,uid,left(p_inquiry->>'vessel',80),left(p_inquiry->>'imo',10),left(p_inquiry->>'port',80),
    nullif(p_inquiry->>'needed_by','')::date,left(p_inquiry->>'quantity',60),left(p_inquiry->>'notes',800),p_channel);
  IF p_channel='online' THEN
    INSERT INTO notifications(crew_id,kind,title,body,icon,screen)
    VALUES(it.seller_id,'market_inquiry','New marketplace inquiry',left('RFQ for '||it.title,140),'📋','home');
  END IF;
  SELECT * INTO c FROM marketplace_item_contacts WHERE item_id=p_item;
  RETURN jsonb_build_object('ok',true,'whatsapp',c.whatsapp,'email',c.email,'charged',v_new AND v_cost>0,'cost',v_cost);
END $function$;