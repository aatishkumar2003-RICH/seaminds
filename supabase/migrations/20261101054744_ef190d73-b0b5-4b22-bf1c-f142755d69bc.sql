ALTER TABLE public.monetization_settings ADD COLUMN IF NOT EXISTS market_contact_credits integer NOT NULL DEFAULT 1;

CREATE TABLE public.marketplace_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL DEFAULT auth.uid(),
  category text NOT NULL CHECK (category IN ('spares','yards','tech')),
  title text NOT NULL CHECK (length(title) BETWEEN 3 AND 160),
  maker text, part_number text,
  origin_country text NOT NULL DEFAULT 'Other',
  stock_ports text[] NOT NULL DEFAULT '{}',
  condition text NOT NULL DEFAULT 'new_oem' CHECK (condition IN ('new_oem','certified_equivalent','reconditioned','service')),
  description text, price_text text, moq text, certification text,
  company text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','withdrawn','hidden')),
  featured boolean NOT NULL DEFAULT false,
  is_sample boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.marketplace_items TO authenticated;
GRANT ALL ON public.marketplace_items TO service_role;
ALTER TABLE public.marketplace_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY mi_read ON public.marketplace_items FOR SELECT TO authenticated USING (status='active' OR seller_id=auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY mi_insert ON public.marketplace_items FOR INSERT TO authenticated WITH CHECK (seller_id=auth.uid() AND public.is_marketplace_seller(auth.uid()) AND featured=false AND is_sample=false);
CREATE POLICY mi_update ON public.marketplace_items FOR UPDATE TO authenticated USING (seller_id=auth.uid() OR public.is_admin(auth.uid())) WITH CHECK (seller_id=auth.uid() OR public.is_admin(auth.uid()));
CREATE INDEX mi_cat_idx ON public.marketplace_items(category, status, featured DESC, created_at DESC);

CREATE OR REPLACE FUNCTION public.marketplace_item_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    IF TG_OP='UPDATE' THEN NEW.featured:=OLD.featured; NEW.is_sample:=OLD.is_sample; NEW.seller_id:=OLD.seller_id;
      IF OLD.status='hidden' THEN NEW.status:='hidden'; END IF;
      IF NEW.status='hidden' THEN NEW.status:=OLD.status; END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_marketplace_item_guard BEFORE UPDATE ON public.marketplace_items FOR EACH ROW EXECUTE FUNCTION public.marketplace_item_guard();

CREATE TABLE public.marketplace_item_contacts (
  item_id uuid PRIMARY KEY REFERENCES public.marketplace_items(id) ON DELETE CASCADE,
  whatsapp text, email text,
  CHECK (whatsapp IS NOT NULL OR email IS NOT NULL)
);
GRANT SELECT, INSERT, UPDATE ON public.marketplace_item_contacts TO authenticated;
GRANT ALL ON public.marketplace_item_contacts TO service_role;
ALTER TABLE public.marketplace_item_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY mic_own ON public.marketplace_item_contacts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.marketplace_items i WHERE i.id=item_id AND (i.seller_id=auth.uid() OR public.is_admin(auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.marketplace_items i WHERE i.id=item_id AND i.seller_id=auth.uid()));

CREATE TABLE public.marketplace_unlocks (
  user_id uuid NOT NULL, item_id uuid NOT NULL REFERENCES public.marketplace_items(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (user_id, item_id)
);
GRANT SELECT ON public.marketplace_unlocks TO authenticated;
GRANT ALL ON public.marketplace_unlocks TO service_role;
ALTER TABLE public.marketplace_unlocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY mu_own ON public.marketplace_unlocks FOR SELECT TO authenticated USING (user_id=auth.uid());

CREATE TABLE public.marketplace_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.marketplace_items(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL,
  vessel text, imo text, port text, needed_by date, quantity text, notes text,
  channel text NOT NULL CHECK (channel IN ('online','whatsapp','email')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.marketplace_inquiries TO authenticated;
GRANT ALL ON public.marketplace_inquiries TO service_role;
ALTER TABLE public.marketplace_inquiries ENABLE ROW LEVEL SECURITY;
CREATE POLICY minq_read ON public.marketplace_inquiries FOR SELECT TO authenticated
  USING (buyer_id=auth.uid() OR public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.marketplace_items i WHERE i.id=item_id AND i.seller_id=auth.uid()));

-- One server path for inquiries and contact unlocks; charges once per buyer+item when monetization is on.
CREATE OR REPLACE FUNCTION public.marketplace_contact(p_item uuid, p_channel text, p_inquiry jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); v_cost int; v_bal int; v_new boolean:=false; it record; c record;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not_signed_in'); END IF;
  IF uid<>'492ee966-e015-4440-a415-6ad6275a4a9b'::uuid THEN RETURN jsonb_build_object('ok',false,'error','owner_preview_only'); END IF;
  IF p_channel NOT IN ('online','whatsapp','email') THEN RETURN jsonb_build_object('ok',false,'error','bad_channel'); END IF;
  SELECT * INTO it FROM marketplace_items WHERE id=p_item AND status='active';
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','not_found'); END IF;
  IF it.is_sample THEN RETURN jsonb_build_object('ok',false,'error','sample'); END IF;
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
END $$;
REVOKE ALL ON FUNCTION public.marketplace_contact(uuid,text,jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.marketplace_contact(uuid,text,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_credit_pricing() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
SELECT jsonb_build_object('crew_paid',coalesce(s.enabled AND s.crew_enabled,false),'manager_paid',coalesce(s.enabled AND s.manager_enabled,false),'boost_day_credits',CASE WHEN s.enabled AND s.crew_enabled THEN s.boost_day_credits ELSE 0 END,'boost_week_credits',CASE WHEN s.enabled AND s.crew_enabled THEN s.boost_week_credits ELSE 0 END,'urgent_block_credits',CASE WHEN s.enabled AND s.manager_enabled THEN s.urgent_block_credits ELSE 0 END,'fleet_block_credits',CASE WHEN s.enabled AND s.manager_enabled THEN s.fleet_block_credits ELSE 0 END,'contact_credits',CASE WHEN s.enabled AND s.manager_enabled THEN s.contact_credits ELSE 0 END,'market_contact_credits',CASE WHEN s.enabled THEN s.market_contact_credits ELSE 0 END,'checkout_ready',false) FROM (SELECT 1) seed LEFT JOIN monetization_settings s ON s.id=true;
$function$;

INSERT INTO public.marketplace_items(seller_id,category,title,maker,part_number,origin_country,stock_ports,condition,description,price_text,moq,certification,company,featured,is_sample) VALUES
('492ee966-e015-4440-a415-6ad6275a4a9b','spares','Purifier bowl O-ring & seal overhaul kit','Alfa Laval (equivalent)','S-type kit','Singapore','{Singapore}','certified_equivalent','Sample listing showing how a spares maker appears.','On request','1 kit','Maker material cert','Sample Supplier',true,true),
('492ee966-e015-4440-a415-6ad6275a4a9b','spares','Viton FKM O-rings — full metric range','Generic','ISO 3601','China','{Ningbo,Shanghai}','new_oem','Sample listing: high-volume O-ring range.','From USD 0.20 / pc','100 pcs',NULL,'Sample Supplier',false,true),
('492ee966-e015-4440-a415-6ad6275a4a9b','spares','Piston ring set for auxiliary engine','Yanmar (genuine)','6EY18','Japan','{Singapore,Busan}','new_oem','Sample listing: genuine maker spares.','On request','1 set','Maker cert','Sample Supplier',false,true),
('492ee966-e015-4440-a415-6ad6275a4a9b','yards','Drydock & afloat repair slots up to 65,000 DWT',NULL,NULL,'Indonesia','{Batam}','service','Sample listing: hull blasting, coating, steel renewal, BWTS retrofit.','Tariff on request',NULL,NULL,'Sample Yard',true,true),
('492ee966-e015-4440-a415-6ad6275a4a9b','yards','Turbocharger overhaul & balancing workshop',NULL,NULL,'India','{Mumbai}','service','Sample listing: service workshop.','On request',NULL,NULL,'Sample Workshop',false,true),
('492ee966-e015-4440-a415-6ad6275a4a9b','tech','Maritime satellite internet kit (authorised reseller)',NULL,NULL,'Other','{Singapore,Dubai}','new_oem','Sample listing: connectivity reseller.','Fleet pricing on request',NULL,NULL,'Sample Reseller',false,true),
('492ee966-e015-4440-a415-6ad6275a4a9b','tech','Flame-retardant anti-static boiler suits',NULL,NULL,'India','{Mumbai,Singapore}','new_oem','Sample listing: PPE supplier.','From USD 18','20 pcs','EN ISO 11612','Sample PPE Supplier',false,true),
('492ee966-e015-4440-a415-6ad6275a4a9b','tech','Portable 4-gas detector (LEL/O2/CO/H2S)','Germany brand',NULL,'Germany','{Rotterdam,Singapore}','new_oem','Sample listing: safety equipment.','On request','1 unit','ATEX','Sample Safety Supplier',false,true);