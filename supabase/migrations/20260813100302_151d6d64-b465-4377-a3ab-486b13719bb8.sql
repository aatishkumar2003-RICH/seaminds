CREATE TABLE IF NOT EXISTS public.ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  feature text NOT NULL,
  model text,
  input_tokens int,
  output_tokens int,
  est_cost_usd numeric(10,5),
  success boolean NOT NULL DEFAULT true,
  latency_ms int,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.ai_usage TO service_role;

CREATE INDEX IF NOT EXISTS idx_ai_usage_month ON public.ai_usage (created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user ON public.ai_usage (user_id, created_at);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;