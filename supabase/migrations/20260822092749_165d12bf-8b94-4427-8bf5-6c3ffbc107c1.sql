CREATE TABLE public.vacancy_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('serp_query','rss','telegram_channel')),
  value text NOT NULL,
  label text,
  region text,
  language text DEFAULT 'en',
  active boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  last_items int,
  last_error text,
  consecutive_failures int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, value)
);

GRANT ALL ON public.vacancy_sources TO service_role;

ALTER TABLE public.vacancy_sources ENABLE ROW LEVEL SECURITY;

INSERT INTO public.vacancy_sources (kind, value, label, region, language) VALUES
('serp_query','Captain Chief Engineer seafarer job vacancy India','Officers India','IN','en'),
('serp_query','Chief Officer 2nd Engineer merchant navy India hiring','Merchant navy India','IN','en'),
('serp_query','Filipino seafarer officer vacancy hiring 2026','Filipino officers','PH','en'),
('serp_query','Manning agency Philippines seaman job hiring','Manning PH','PH','en'),
('serp_query','Master mariner LNG tanker job India Mumbai','LNG Mumbai','IN','en'),
('serp_query','Marine engineer officer job Chennai Kolkata India','Engineers India','IN','en'),
('serp_query','Captain Chief Engineer job Manila Philippines','Officers Manila','PH','en'),
('serp_query','AB OS rating seafarer job Philippines hiring','Ratings PH','PH','en'),
('serp_query','offshore DP officer job vacancy India','Offshore DP India','IN','en'),
('serp_query','FPSO tanker engineer officer job Southeast Asia','FPSO SEA','SEA','en'),
('serp_query','Indonesian seafarer crew job vacancy 2026','Crew Indonesia','ID','en'),
('serp_query','manning agency Indonesia Jakarta seaman hiring','Manning Jakarta','ID','en'),
('serp_query','Ukrainian seafarer officer job vacancy Europe','Officers Ukraine','UA','en'),
('serp_query','крюинг вакансії моряк Україна officer','Crewing Ukraine (UA)','UA','uk'),
('serp_query','Bangladesh seafarer officer engineer job hiring','Officers Bangladesh','BD','en'),
('serp_query','Myanmar seaman crew job vacancy hiring','Crew Myanmar','MM','en'),
('rss','https://gcaptain.com/feed','gCaptain',NULL,'en'),
('rss','https://splash247.com/feed','Splash 247',NULL,'en'),
('rss','https://www.seatrade-maritime.com/rss.xml','Seatrade Maritime',NULL,'en'),
('rss','https://maritime-executive.com/rss','Maritime Executive',NULL,'en'),
('rss','https://www.marineinsight.com/feed','Marine Insight',NULL,'en'),
('telegram_channel','offshorevacancies','Offshore Vacancies',NULL,'en'),
('telegram_channel','seafarersvacancies','Seafarers Vacancies',NULL,'en'),
('telegram_channel','marinemanjobs','Marine Man Jobs',NULL,'en'),
('telegram_channel','craborabota','Crab Rabota','UA','ru'),
('telegram_channel','seabordjobs','Seabord Jobs',NULL,'en'),
('telegram_channel','marinejobbangladesh','Marine Job Bangladesh','BD','en');