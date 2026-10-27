CREATE OR REPLACE FUNCTION public.normalize_job_posting()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_raw text; v_digits text; v_company text; v_trusted boolean;
BEGIN
  v_raw := nullif(btrim(coalesce(NEW.contact_whatsapp, '')), '');
  IF v_raw IS NOT NULL THEN
    IF left(v_raw, 1) = '+' THEN
      v_digits := regexp_replace(substr(v_raw, 2), '[^0-9]', '', 'g');
      NEW.contact_whatsapp := CASE WHEN v_digits = '' THEN v_raw ELSE '+' || v_digits END;
    ELSE
      v_digits := regexp_replace(v_raw, '[^0-9]', '', 'g');
      IF left(v_digits, 2) = '00' AND length(v_digits) > 2 THEN
        NEW.contact_whatsapp := '+' || substr(v_digits, 3);
      ELSE
        NEW.contact_whatsapp := v_raw;
      END IF;
    END IF;
  END IF;

  IF NEW.contact_email IS NOT NULL THEN
    NEW.contact_email := nullif(lower(btrim(NEW.contact_email)), '');
  END IF;

  -- Verified badge only for admin-approved or doc-verified companies posting their own rows; never client-forged.
  IF auth.uid() IS NOT NULL AND NEW.manager_id = auth.uid() THEN
    SELECT mp.company_name,
           (coalesce(mp.admin_approved, false) OR coalesce(mp.company_verified, false))
      INTO v_company, v_trusted
      FROM public.manager_profiles mp WHERE mp.user_id = auth.uid() LIMIT 1;
    IF FOUND THEN
      IF v_trusted THEN
        IF v_company IS NOT NULL THEN NEW.company_name := v_company; END IF;
        NEW.verified := true;
      ELSE
        NEW.verified := false;
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();
    NEW.created_at := OLD.created_at;
  END IF;
  RETURN NEW;
END $function$;