INSERT INTO public.vacancy_sources (kind, value, label, language, region, method, active)
SELECT v.kind, v.value, v.label, v.language, v.region, 'auto', true
FROM (VALUES
  ('telegram_channel','seamanvacancy','Seaman Vacancy','en','GLOBAL'),
  ('telegram_channel','seaman_jobs','Seaman Jobs','en','GLOBAL'),
  ('telegram_channel','marinejobs','Marine Jobs','en','GLOBAL'),
  ('telegram_channel','seafarer_jobs','Seafarer Jobs','en','GLOBAL'),
  ('telegram_channel','crewjobs','Crew Jobs','en','GLOBAL'),
  ('telegram_channel','seaman_vacancy','Seaman Vacancy 2','en','GLOBAL'),
  ('telegram_channel','kerjakapal','Kerja Kapal','id','ID')
) AS v(kind, value, label, language, region)
WHERE NOT EXISTS (SELECT 1 FROM public.vacancy_sources s WHERE s.kind = v.kind AND s.value = v.value);

INSERT INTO public.vacancy_sources (kind, value, url, label, language, region, method, active)
SELECT 'career_page', v.value, v.url, v.label, 'en', 'PH', 'auto', true
FROM (VALUES
  ('magsaysay','https://www.magsaysay.com.ph/careers','Magsaysay Maritime (Manila)'),
  ('ptc','https://www.ptc.com.ph/careers','Philippine Transmarine Carriers'),
  ('bsm_ph','https://www.bs-shipmanagement.com/careers','BSM Philippines')
) AS v(value, url, label)
WHERE NOT EXISTS (SELECT 1 FROM public.vacancy_sources s WHERE s.kind='career_page' AND s.value = v.value);

NOTIFY pgrst, 'reload schema';