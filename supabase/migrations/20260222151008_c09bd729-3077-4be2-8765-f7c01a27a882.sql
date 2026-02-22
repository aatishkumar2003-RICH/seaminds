CREATE TABLE public.smc_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('crew', 'manager', 'bulk')),
  stripe_session_id TEXT,
  amount_paid INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  assessment_unlocked BOOLEAN NOT NULL DEFAULT false,
  crew_profile_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.smc_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert smc_payments" ON public.smc_payments FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read smc_payments" ON public.smc_payments FOR SELECT USING (true);
CREATE POLICY "Anyone can update smc_payments" ON public.smc_payments FOR UPDATE USING (true) WITH CHECK (true);