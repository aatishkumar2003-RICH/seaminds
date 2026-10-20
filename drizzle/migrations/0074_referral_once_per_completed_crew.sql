CREATE UNIQUE INDEX uq_credit_referral_event ON public.credit_ledger(reason) WHERE reason LIKE 'referral_%' AND reason<>'referral_joined';
CREATE FUNCTION public.protect_credit_referrer() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN IF OLD.referred_by IS NOT NULL AND NEW.referred_by IS DISTINCT FROM OLD.referred_by THEN RAISE EXCEPTION 'A claimed inviter cannot be changed'; END IF; RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.protect_credit_referrer() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER protect_credit_referrer BEFORE UPDATE OF referred_by ON public.crew_profiles FOR EACH ROW EXECUTE FUNCTION public.protect_credit_referrer();
NOTIFY pgrst,'reload schema';