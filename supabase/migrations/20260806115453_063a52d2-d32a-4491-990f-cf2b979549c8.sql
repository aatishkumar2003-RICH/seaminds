DROP POLICY IF EXISTS "Owner manages own smc_payments" ON public.smc_payments;
CREATE POLICY "Owner reads own smc_payments"
ON public.smc_payments FOR SELECT TO authenticated
USING ((crew_profile_id = auth.uid()) OR (user_id = auth.uid()));
GRANT ALL ON public.smc_payments TO service_role;