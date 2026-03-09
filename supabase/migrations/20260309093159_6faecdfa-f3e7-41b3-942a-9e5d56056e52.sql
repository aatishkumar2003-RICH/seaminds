
CREATE TABLE public.auth_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  attempt_count integer NOT NULL DEFAULT 1,
  window_start timestamp with time zone NOT NULL DEFAULT now(),
  last_attempt timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_auth_rate_limits_ip ON public.auth_rate_limits (ip_address);

ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only for auth_rate_limits"
  ON public.auth_rate_limits
  FOR ALL
  USING (false)
  WITH CHECK (false);
