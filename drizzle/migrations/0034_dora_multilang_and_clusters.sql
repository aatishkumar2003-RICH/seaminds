ALTER TABLE public.dora_articles DROP CONSTRAINT IF EXISTS dora_articles_slug_key;
ALTER TABLE public.dora_articles ADD CONSTRAINT dora_articles_slug_language_key UNIQUE (slug, language);

CREATE OR REPLACE FUNCTION public.dora_search_articles_lang(p_query text, p_language text DEFAULT 'en', p_limit integer DEFAULT 4)
RETURNS TABLE(slug text, domain text, title text, body text, rank real, language text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH q AS (SELECT websearch_to_tsquery('english', left(coalesce(p_query,''), 300)) AS tq),
  hits AS (
    SELECT a.slug, a.domain, a.title, a.body, ts_rank(a.search_tsv, q.tq) AS rank, a.language,
           row_number() OVER (PARTITION BY a.slug ORDER BY (a.language = coalesce(p_language,'en')) DESC) AS rn
    FROM public.dora_articles a, q
    WHERE a.status = 'PUBLISHED' AND a.language IN (coalesce(p_language,'en'), 'en') AND a.search_tsv @@ q.tq
  )
  SELECT slug, domain, title, body, rank, language FROM hits WHERE rn = 1
  ORDER BY rank DESC LIMIT LEAST(GREATEST(coalesce(p_limit,4),1),4);
$$;
REVOKE ALL ON FUNCTION public.dora_search_articles_lang(text,text,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dora_search_articles_lang(text,text,integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.dora_log_unanswered(p_key text, p_summary text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.dora_unanswered_clusters (cluster_key, summary)
  VALUES (left(p_key,120), left(p_summary,300))
  ON CONFLICT (cluster_key) DO UPDATE SET hit_count = dora_unanswered_clusters.hit_count + 1, last_seen = now(),
    status = CASE WHEN dora_unanswered_clusters.status = 'ARTICLE_ADDED' THEN 'OPEN' ELSE dora_unanswered_clusters.status END;
$$;
REVOKE ALL ON FUNCTION public.dora_log_unanswered(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dora_log_unanswered(text,text) TO service_role;