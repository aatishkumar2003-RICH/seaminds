CREATE OR REPLACE FUNCTION public.get_active_credit_plans(p_audience text)
RETURNS TABLE(id uuid, name text, price_usd numeric, credits integer, "interval" text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, name, price_usd::numeric, credits::integer, "interval"::text
  FROM credit_plans WHERE active AND audience = p_audience ORDER BY price_usd;
$$;
REVOKE ALL ON FUNCTION public.get_active_credit_plans(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_active_credit_plans(text) TO authenticated;
NOTIFY pgrst, 'reload schema';