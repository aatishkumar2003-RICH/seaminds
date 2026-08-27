ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS link text;
CREATE INDEX IF NOT EXISTS idx_notif_link ON public.notifications (crew_id, kind, link);