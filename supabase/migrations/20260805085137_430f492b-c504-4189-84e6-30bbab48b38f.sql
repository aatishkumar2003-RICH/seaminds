-- Fix critical security findings:
-- 1. crew_profiles_self_verification_tampering
-- 2. smc_assessments_self_score_tampering

-- ============================================
-- 1. Prevent crew from self-updating verification flags on crew_profiles
-- ============================================

DROP POLICY IF EXISTS "crew_update" ON public.crew_profiles;

CREATE POLICY "crew_update_restricted"
ON public.crew_profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND email_verified IS NOT DISTINCT FROM email_verified
  AND whatsapp_verified IS NOT DISTINCT FROM whatsapp_verified
  AND phone_valid IS NOT DISTINCT FROM phone_valid
  AND cdc_applied IS NOT DISTINCT FROM cdc_applied
);

CREATE OR REPLACE FUNCTION public.prevent_crew_verification_tampering()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (
    current_user = 'service_role'
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
$$;

DROP TRIGGER IF EXISTS prevent_crew_verification_tampering_trigger ON public.crew_profiles;
CREATE TRIGGER prevent_crew_verification_tampering_trigger
BEFORE UPDATE ON public.crew_profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_crew_verification_tampering();

GRANT ALL ON public.crew_profiles TO service_role;


-- ============================================
-- 2. Prevent crew from self-updating SMC scoring fields
-- ============================================

DROP POLICY IF EXISTS "Users can update own smc_assessments" ON public.smc_assessments;
DROP POLICY IF EXISTS "crew_update_assessment" ON public.smc_assessments;

CREATE POLICY "crew_update_smc_non_scoring"
ON public.smc_assessments
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.crew_profiles cp
    WHERE cp.id = public.smc_assessments.crew_profile_id
      AND cp.id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.crew_profiles cp
    WHERE cp.id = public.smc_assessments.crew_profile_id
      AND cp.id = auth.uid()
  )
  AND overall_score IS NOT DISTINCT FROM overall_score
  AND score_band IS NOT DISTINCT FROM score_band
  AND certificate_id IS NOT DISTINCT FROM certificate_id
  AND recommendation IS NOT DISTINCT FROM recommendation
  AND dimension_scores IS NOT DISTINCT FROM dimension_scores
);

CREATE OR REPLACE FUNCTION public.prevent_smc_score_tampering()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (
    current_user = 'service_role'
    OR public.is_admin(auth.uid())
  ) THEN
    RETURN NEW;
  END IF;

  IF (
    NEW.overall_score IS DISTINCT FROM OLD.overall_score
    OR NEW.score_band IS DISTINCT FROM OLD.score_band
    OR NEW.certificate_id IS DISTINCT FROM OLD.certificate_id
    OR NEW.recommendation IS DISTINCT FROM OLD.recommendation
    OR NEW.dimension_scores IS DISTINCT FROM OLD.dimension_scores
  ) THEN
    RAISE EXCEPTION 'SMC scoring fields can only be updated by admin or service role';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_smc_score_tampering_trigger ON public.smc_assessments;
CREATE TRIGGER prevent_smc_score_tampering_trigger
BEFORE UPDATE ON public.smc_assessments
FOR EACH ROW
EXECUTE FUNCTION public.prevent_smc_score_tampering();

GRANT ALL ON public.smc_assessments TO service_role;