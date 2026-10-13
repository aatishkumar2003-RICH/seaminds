CREATE OR REPLACE FUNCTION public.prevent_crew_verification_tampering()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  -- SECURITY DEFINER makes current_user the owner, so check the caller's JWT role / session.
  IF (
    auth.role() = 'service_role'
    OR session_user IN ('postgres','supabase_admin')
    OR public.is_admin(auth.uid())
  ) THEN
    RETURN NEW;
  END IF;
  IF (
    NEW.email_verified IS DISTINCT FROM OLD.email_verified
    OR NEW.whatsapp_verified IS DISTINCT FROM OLD.whatsapp_verified
    OR NEW.phone_valid IS DISTINCT FROM OLD.phone_valid
    OR NEW.cdc_applied IS DISTINCT FROM OLD.cdc_applied
  ) THEN
    RAISE EXCEPTION 'Verification flags can only be updated by admin or service role';
  END IF;
  RETURN NEW;
END;
$function$;

-- Backfill: seafarers who entered a correct email code but were blocked.
UPDATE public.crew_profiles p
SET email_verified = true,
    email_verified_at = v.verified_at,
    email = v.target
FROM (
  SELECT DISTINCT ON (user_id) user_id, target, verified_at
  FROM public.contact_verifications
  WHERE channel = 'email' AND verified_at IS NOT NULL
  ORDER BY user_id, verified_at DESC
) v
WHERE p.id = v.user_id AND p.email_verified = false;