ALTER TABLE public.vacancy_sources DROP CONSTRAINT IF EXISTS vacancy_sources_kind_check;
ALTER TABLE public.vacancy_sources ADD CONSTRAINT vacancy_sources_kind_check CHECK (kind = ANY (ARRAY['serp_query','rss','telegram_channel','career_page']));
ALTER TABLE public.vacancy_sources ADD COLUMN IF NOT EXISTS url text;
ALTER TABLE public.vacancy_sources ADD COLUMN IF NOT EXISTS method text NOT NULL DEFAULT 'auto';
ALTER TABLE public.vacancy_sources ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.vacancy_sources DROP CONSTRAINT IF EXISTS vacancy_sources_method_check;
ALTER TABLE public.vacancy_sources ADD CONSTRAINT vacancy_sources_method_check CHECK (method = ANY (ARRAY['auto','jsonld','ats','html']));