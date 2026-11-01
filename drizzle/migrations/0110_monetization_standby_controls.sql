CREATE TABLE public.monetization_settings (
 id boolean PRIMARY KEY DEFAULT true CHECK (id),
 enabled boolean NOT NULL DEFAULT false,
 crew_enabled boolean NOT NULL DEFAULT true,
 manager_enabled boolean NOT NULL DEFAULT true,
 boost_day_credits integer NOT NULL DEFAULT 1 CHECK (boost_day_credits BETWEEN 0 AND 1000000),
 boost_week_credits integer NOT NULL DEFAULT 5 CHECK (boost_week_credits BETWEEN 0 AND 1000000),
 urgent_block_credits integer NOT NULL DEFAULT 5 CHECK (urgent_block_credits BETWEEN 0 AND 1000000),
 fleet_block_credits integer NOT NULL DEFAULT 5 CHECK (fleet_block_credits BETWEEN 0 AND 1000000),
 contact_credits integer NOT NULL DEFAULT 1 CHECK (contact_credits BETWEEN 0 AND 1000000),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.monetization_settings TO authenticated;
GRANT ALL ON public.monetization_settings TO service_role;
ALTER TABLE public.monetization_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_monetization ON public.monetization_settings FOR ALL TO authenticated USING (auth.uid()='492ee966-e015-4440-a415-6ad6275a4a9b'::uuid) WITH CHECK (auth.uid()='492ee966-e015-4440-a415-6ad6275a4a9b'::uuid);
CREATE TRIGGER audit_monetization_controls BEFORE INSERT OR UPDATE ON public.monetization_settings FOR EACH ROW EXECUTE FUNCTION public.audit_credit_controls();
CREATE FUNCTION public.get_credit_pricing() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
SELECT jsonb_build_object('crew_paid',coalesce(s.enabled AND s.crew_enabled,false),'manager_paid',coalesce(s.enabled AND s.manager_enabled,false),'boost_day_credits',CASE WHEN s.enabled AND s.crew_enabled THEN s.boost_day_credits ELSE 0 END,'boost_week_credits',CASE WHEN s.enabled AND s.crew_enabled THEN s.boost_week_credits ELSE 0 END,'urgent_block_credits',CASE WHEN s.enabled AND s.manager_enabled THEN s.urgent_block_credits ELSE 0 END,'fleet_block_credits',CASE WHEN s.enabled AND s.manager_enabled THEN s.fleet_block_credits ELSE 0 END,'contact_credits',CASE WHEN s.enabled AND s.manager_enabled THEN s.contact_credits ELSE 0 END,'checkout_ready',false) FROM (SELECT 1) seed LEFT JOIN monetization_settings s ON s.id=true;
$$;
REVOKE ALL ON FUNCTION public.get_credit_pricing() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_credit_pricing() TO authenticated;
CREATE OR REPLACE FUNCTION public.boost_my_profile(p_days integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid:=auth.uid(); v_cost int; v_bal int; v_until timestamptz; pricing jsonb;
BEGIN
 IF u IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','not_signed_in'); END IF;
 IF p_days NOT IN (1,7) OR p_days IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','invalid_plan'); END IF;
 IF NOT EXISTS(SELECT 1 FROM crew_profiles WHERE id=u) THEN RETURN jsonb_build_object('ok',false,'reason','no_profile'); END IF;
 PERFORM pg_advisory_xact_lock(hashtext('credits:'||u::text));
 pricing:=get_credit_pricing(); v_cost:=coalesce((pricing->>CASE WHEN p_days=1 THEN 'boost_day_credits' ELSE 'boost_week_credits' END)::int,0);
 SELECT coalesce(sum(delta),0) INTO v_bal FROM credit_ledger WHERE manager_user_id=u;
 IF v_bal<v_cost THEN RETURN jsonb_build_object('ok',false,'reason','insufficient_credits','balance',v_bal); END IF;
 IF v_cost>0 THEN INSERT INTO credit_ledger(manager_user_id,delta,reason) VALUES(u,-v_cost,'crew_boost_'||p_days||'d_'||gen_random_uuid()::text); END IF;
 INSERT INTO crew_boosts(crew_id,boosted_until) VALUES(u,now()+make_interval(days=>p_days)) ON CONFLICT(crew_id) DO UPDATE SET boosted_until=greatest(crew_boosts.boosted_until,now())+make_interval(days=>p_days),updated_at=now() RETURNING boosted_until INTO v_until;
 RETURN jsonb_build_object('ok',true,'boosted_until',v_until,'balance',v_bal-v_cost,'credits',v_cost);
END $$;
CREATE OR REPLACE FUNCTION public.promote_vacancies(p_ids uuid[],p_campaign text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_uid uuid:=auth.uid(); v_ids uuid[]; v_n int; v_cost int; v_bal int; v_batch uuid:=gen_random_uuid(); v_hours int; pricing jsonb;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Please sign in'; END IF;
 IF p_campaign IS NULL OR p_campaign NOT IN ('urgent','fleet') THEN RAISE EXCEPTION 'Unknown campaign'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('credits:'||v_uid::text));
 SELECT array_agg(DISTINCT j.id) INTO v_ids FROM job_postings j WHERE j.id=ANY(p_ids) AND j.manager_id=v_uid AND j.status='active' AND NOT EXISTS(SELECT 1 FROM vacancy_promotions p WHERE p.posting_id=j.id AND p.ends_at>now());
 v_n:=coalesce(array_length(v_ids,1),0);
 IF v_n=0 THEN RAISE EXCEPTION 'No eligible vacancies (already promoted or not yours)'; END IF;
 IF v_n>100 THEN RAISE EXCEPTION 'Maximum 100 vacancies per promotion'; END IF;
 pricing:=get_credit_pricing();
 IF p_campaign='urgent' THEN v_cost:=coalesce((pricing->>'urgent_block_credits')::int,0)*ceil(v_n/5.0)::int; v_hours:=48;
 ELSE v_cost:=coalesce((pricing->>'fleet_block_credits')::int,0)*ceil(v_n/10.0)::int; v_hours:=168; END IF;
 SELECT coalesce(sum(delta),0) INTO v_bal FROM credit_ledger WHERE manager_user_id=v_uid;
 IF v_bal<v_cost THEN RAISE EXCEPTION 'Not enough credits: need %, you have %',v_cost,v_bal; END IF;
 IF v_cost>0 THEN INSERT INTO credit_ledger(manager_user_id,delta,reason) VALUES(v_uid,-v_cost,'promotion:'||p_campaign||':'||v_batch::text); END IF;
 INSERT INTO vacancy_promotions(posting_id,manager_id,campaign,batch_id,ends_at) SELECT x,v_uid,p_campaign,v_batch,now()+make_interval(hours=>v_hours) FROM unnest(v_ids) x;
 RETURN jsonb_build_object('promoted',v_n,'credits',v_cost,'balance',v_bal-v_cost);
END $$;
CREATE OR REPLACE FUNCTION public.reveal_contact(p_crew_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); v_bal int; v_email text; v_wa text; v_company text; v_new boolean:=false; v_cost int;
BEGIN
 IF uid IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not_signed_in'); END IF;
 IF uid<>'492ee966-e015-4440-a415-6ad6275a4a9b'::uuid THEN RETURN jsonb_build_object('ok',false,'error','owner_preview_only'); END IF;
 SELECT company_name INTO v_company FROM manager_profiles WHERE user_id=uid AND coalesce(admin_approved,false)=true;
 PERFORM pg_advisory_xact_lock(hashtext('credits:'||uid::text));
 v_cost:=coalesce((get_credit_pricing()->>'contact_credits')::int,0);
 IF NOT EXISTS(SELECT 1 FROM crew_profiles WHERE id=p_crew_id) THEN RETURN jsonb_build_object('ok',false,'error','not_found'); END IF;
 IF NOT EXISTS(SELECT 1 FROM contact_reveals WHERE manager_user_id=uid AND crew_id=p_crew_id) THEN
 SELECT coalesce(sum(delta),0) INTO v_bal FROM credit_ledger WHERE manager_user_id=uid;
 IF v_bal<v_cost THEN RETURN jsonb_build_object('ok',false,'error','no_credits'); END IF;
 INSERT INTO contact_reveals(manager_user_id,crew_id) VALUES(uid,p_crew_id);
 IF v_cost>0 THEN INSERT INTO credit_ledger(manager_user_id,delta,reason) VALUES(uid,-v_cost,'reveal:'||p_crew_id); END IF;
 v_new:=true;
 INSERT INTO notifications(crew_id,kind,title,body,icon,screen) VALUES(p_crew_id,'contact_viewed','A company viewed your contact','Your contact details were viewed.','👀','home');
 END IF;
 SELECT coalesce(cp.email,u.email),cp.whatsapp_number INTO v_email,v_wa FROM crew_profiles cp LEFT JOIN auth.users u ON u.id=cp.id WHERE cp.id=p_crew_id;
 RETURN jsonb_build_object('ok',true,'email',v_email,'whatsapp',v_wa,'charged',v_new AND v_cost>0,'balance',coalesce((SELECT sum(delta) FROM credit_ledger WHERE manager_user_id=uid),0));
END $$;
NOTIFY pgrst,'reload schema';