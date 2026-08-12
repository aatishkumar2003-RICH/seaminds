CREATE TABLE IF NOT EXISTS public.entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holder_id uuid NOT NULL, product text NOT NULL,
  status text NOT NULL DEFAULT 'active', valid_until date,
  source text NOT NULL DEFAULT 'manual', external_ref text,
  amount_cents int, currency text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.entitlements TO authenticated;
GRANT ALL ON public.entitlements TO service_role;
CREATE INDEX IF NOT EXISTS idx_entitlements_holder ON public.entitlements (holder_id, product, status);
ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.cached_stats (
  key text PRIMARY KEY, value jsonb, updated_at timestamptz DEFAULT now());
GRANT SELECT ON public.cached_stats TO authenticated;
GRANT ALL ON public.cached_stats TO service_role;
ALTER TABLE public.cached_stats ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_notif_dedupe ON public.notifications (crew_id, kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_created ON public.notifications (created_at);
CREATE INDEX IF NOT EXISTS idx_applications_post ON public.job_applications (company_post_id);