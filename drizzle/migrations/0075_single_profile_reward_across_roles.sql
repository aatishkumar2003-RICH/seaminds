CREATE UNIQUE INDEX uq_credit_profile_reward ON public.credit_ledger(manager_user_id) WHERE reason IN ('cv_completed','manager_profile_completed');
NOTIFY pgrst,'reload schema';