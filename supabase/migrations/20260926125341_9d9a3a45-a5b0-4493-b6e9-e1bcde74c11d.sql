-- Retire dead Indonesian sources (pelaut.com times out, kapal.co.id returns 404)
UPDATE public.vacancy_sources
SET active = false,
    notes = coalesce(notes || ' | ', '') || 'Retired 2026-09: host unreachable / 404'
WHERE value IN ('pelaut', 'kapal') OR url ILIKE '%pelaut.com%' OR url ILIKE '%kapal.co.id%';

-- Indonesian Telegram seafarer channels (verified live)
INSERT INTO public.vacancy_sources (kind, value, label, region, language, active, method, notes)
SELECT * FROM (VALUES
  ('telegram_channel', 'jobspelaut', 'Jobs Pelaut (ID)', 'Indonesia', 'id', true, 'auto', 'Daily Indonesian vacancies'),
  ('telegram_channel', 'lowonganpelaut', 'Lowongan Pelaut (ID)', 'Indonesia', 'id', true, 'auto', 'Indonesian manning postings'),
  ('telegram_channel', 'pelautnusantara', 'Pelaut Nusantara (ID)', 'Indonesia', 'id', true, 'auto', 'Indonesian seafarer community'),
  ('telegram_channel', 'SeafarersCareerHub', 'Marine Crew Opportunities', 'Global', 'en', true, 'auto', 'SE Asia friendly bulk fleet')
) AS v(kind, value, label, region, language, active, method, notes)
WHERE NOT EXISTS (
  SELECT 1 FROM public.vacancy_sources s WHERE s.kind = v.kind AND s.value = v.value
);

-- Indonesian shipping company career pages (verified reachable)
INSERT INTO public.vacancy_sources (kind, value, label, region, language, active, method, url, notes)
SELECT * FROM (VALUES
  ('career_page', 'samudera', 'PT Samudera Indonesia', 'Indonesia', 'id', true, 'auto', 'https://www.samudera.id/career', 'Indonesian fleet operator'),
  ('career_page', 'spil', 'PT Salam Pacific Indonesia Lines', 'Indonesia', 'id', true, 'auto', 'https://www.spil.co.id/career', 'Container fleet'),
  ('career_page', 'soechi', 'PT Soechi Lines', 'Indonesia', 'id', true, 'auto', 'https://www.soechi.com/career', 'Tanker fleet'),
  ('career_page', 'kapaldanlogistik', 'Kapal dan Logistik vacancy digest', 'Indonesia', 'id', true, 'auto', 'https://www.kapaldanlogistik.com/', 'Monthly Indonesian vacancy digest (handled by dedicated scraper)')
) AS v(kind, value, label, region, language, active, method, url, notes)
WHERE NOT EXISTS (
  SELECT 1 FROM public.vacancy_sources s WHERE s.kind = v.kind AND s.value = v.value
);

NOTIFY pgrst, 'reload schema';