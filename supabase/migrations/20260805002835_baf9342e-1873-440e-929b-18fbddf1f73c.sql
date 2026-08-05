-- Fix discount_codes exposure: restrict SELECT to admin, add RPC helpers for checkout

DROP POLICY IF EXISTS "read_discount_codes" ON public.discount_codes;

ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can read discount_codes"
  ON public.discount_codes
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Keep existing admin write policies (they already use is_admin)
-- Admins insert/update/delete are already in place.

-- Validate a discount code for a given product scope without exposing the table
CREATE OR REPLACE FUNCTION public.validate_discount_code(input_code text, product_scope text)
RETURNS SETOF public.discount_codes
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.discount_codes
  WHERE active = true
    AND code = upper(input_code)
    AND (valid_until IS NULL OR valid_until > now())
    AND (max_uses IS NULL OR uses_count < max_uses)
    AND (applies_to = 'all' OR applies_to = product_scope);
$$;

-- Increment use count for a discount code
CREATE OR REPLACE FUNCTION public.increment_discount_uses(input_code text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.discount_codes
  SET uses_count = uses_count + 1
  WHERE code = upper(input_code)
    AND active = true
    AND (max_uses IS NULL OR uses_count < max_uses);
$$;

GRANT EXECUTE ON FUNCTION public.validate_discount_code(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_discount_uses(text) TO authenticated;