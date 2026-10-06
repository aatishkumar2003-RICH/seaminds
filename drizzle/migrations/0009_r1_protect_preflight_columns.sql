CREATE OR REPLACE FUNCTION public.protect_preflight_columns()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- Only the preflight_assessment/confirm_preflight definer functions (owner role) or service role may write these.
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.preflight_context := NULL; NEW.preflight_source := NULL; NEW.preflight_confirmed_at := NULL;
    ELSE
      NEW.preflight_context := OLD.preflight_context;
      NEW.preflight_source := OLD.preflight_source;
      NEW.preflight_confirmed_at := OLD.preflight_confirmed_at;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_protect_preflight_columns ON public.smc_assessments;
CREATE TRIGGER trg_protect_preflight_columns BEFORE INSERT OR UPDATE ON public.smc_assessments
FOR EACH ROW EXECUTE FUNCTION public.protect_preflight_columns();