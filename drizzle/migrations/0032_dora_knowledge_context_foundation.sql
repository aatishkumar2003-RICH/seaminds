CREATE TABLE public.dora_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{3,80}$'),
  domain text NOT NULL CHECK (domain IN ('ACCOUNT','CV','CERTIFICATES','SMC','CV_VERIFIED','INTERVIEW','JOBS','SUPPORT')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 160),
  body text NOT NULL CHECK (char_length(body) BETWEEN 10 AND 6000),
  tags text[] NOT NULL DEFAULT '{}',
  intents text[] NOT NULL DEFAULT '{}',
  language text NOT NULL DEFAULT 'en' CHECK (language IN ('en','hi','id','tl','vi')),
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PUBLISHED','ARCHIVED')),
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  search_tsv tsvector
);
CREATE OR REPLACE FUNCTION public.dora_articles_tsv() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.search_tsv := setweight(to_tsvector('english', coalesce(NEW.title,'')), 'A') ||
                    setweight(to_tsvector('english', array_to_string(NEW.tags,' ')), 'B') ||
                    setweight(to_tsvector('english', coalesce(NEW.body,'')), 'C');
  NEW.updated_at := now();
  IF TG_OP = 'UPDATE' AND (NEW.body IS DISTINCT FROM OLD.body OR NEW.title IS DISTINCT FROM OLD.title) THEN
    NEW.version := OLD.version + 1;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_dora_articles_tsv BEFORE INSERT OR UPDATE ON public.dora_articles FOR EACH ROW EXECUTE FUNCTION public.dora_articles_tsv();
CREATE INDEX dora_articles_tsv_idx ON public.dora_articles USING gin (search_tsv);
CREATE INDEX dora_articles_pub_idx ON public.dora_articles (status, domain);
GRANT SELECT, INSERT, UPDATE ON public.dora_articles TO authenticated;
GRANT SELECT ON public.dora_articles TO anon;
GRANT ALL ON public.dora_articles TO service_role;
ALTER TABLE public.dora_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published articles readable" ON public.dora_articles FOR SELECT TO anon, authenticated USING (status = 'PUBLISHED');
CREATE POLICY "Admins read all articles" ON public.dora_articles FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins insert articles" ON public.dora_articles FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins update articles" ON public.dora_articles FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.dora_unanswered_clusters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_key text NOT NULL UNIQUE CHECK (char_length(cluster_key) BETWEEN 3 AND 120),
  summary text NOT NULL CHECK (char_length(summary) BETWEEN 3 AND 300),
  domain text,
  hit_count integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','ARTICLE_ADDED','IGNORED')),
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.dora_unanswered_clusters TO authenticated;
GRANT ALL ON public.dora_unanswered_clusters TO service_role;
ALTER TABLE public.dora_unanswered_clusters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read clusters" ON public.dora_unanswered_clusters FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins update clusters" ON public.dora_unanswered_clusters FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.dora_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  intent text CHECK (char_length(intent) <= 60),
  route_template text CHECK (char_length(route_template) <= 120),
  articles_used text[] NOT NULL DEFAULT '{}',
  account_tool_used text CHECK (char_length(account_tool_used) <= 60),
  screenshot_used boolean NOT NULL DEFAULT false,
  outcome text NOT NULL CHECK (outcome IN ('ANSWERED','DETERMINISTIC','ESCALATED','UNANSWERED','BLOCKED_SEALED','ERROR')),
  latency_ms integer,
  model text,
  est_cost_usd numeric(10,5),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX dora_interactions_time_idx ON public.dora_interactions (created_at DESC);
CREATE INDEX dora_interactions_user_time_idx ON public.dora_interactions (user_id, created_at DESC);
GRANT SELECT ON public.dora_interactions TO authenticated;
GRANT ALL ON public.dora_interactions TO service_role;
ALTER TABLE public.dora_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read interactions" ON public.dora_interactions FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.dora_search_articles(p_query text, p_domain text DEFAULT NULL, p_limit integer DEFAULT 4)
RETURNS TABLE(slug text, domain text, title text, body text, rank real)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.slug, a.domain, a.title, a.body,
         ts_rank(a.search_tsv, websearch_to_tsquery('english', left(coalesce(p_query,''), 300))) AS rank
  FROM public.dora_articles a
  WHERE a.status = 'PUBLISHED'
    AND (p_domain IS NULL OR a.domain = p_domain)
    AND a.search_tsv @@ websearch_to_tsquery('english', left(coalesce(p_query,''), 300))
  ORDER BY rank DESC
  LIMIT LEAST(GREATEST(coalesce(p_limit,4),1),4);
$$;
REVOKE ALL ON FUNCTION public.dora_search_articles(text,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dora_search_articles(text,text,integer) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.dora_get_my_context()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_cp public.crew_profiles%ROWTYPE;
  v_has_cv boolean := false;
  v_cert_count integer := 0;
  v_smc jsonb := NULL;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('signed_in', false);
  END IF;
  SELECT * INTO v_cp FROM public.crew_profiles WHERE id = v_uid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('signed_in', true, 'has_crew_profile', false);
  END IF;
  SELECT true, CASE WHEN jsonb_typeof(d.certificates) = 'array' THEN jsonb_array_length(d.certificates) ELSE 0 END
    INTO v_has_cv, v_cert_count
  FROM public.crew_cv_data d WHERE d.user_id = v_uid OR d.id = v_uid LIMIT 1;
  SELECT jsonb_build_object('status', s.status, 'tier', s.scoring_tier, 'round', s.assessment_round,
           'completed', s.completed_at IS NOT NULL, 'scored', s.overall_score IS NOT NULL)
    INTO v_smc
  FROM public.smc_assessments s WHERE s.crew_profile_id = v_uid ORDER BY s.started_at DESC NULLS LAST LIMIT 1;
  RETURN jsonb_build_object(
    'signed_in', true,
    'has_crew_profile', true,
    'rank', v_cp.rank,
    'quick_profile_done', v_cp.quick_profile_completed_at IS NOT NULL,
    'onboarding_complete', coalesce(v_cp.onboarding_complete, false),
    'is_available', coalesce(v_cp.is_available, false),
    'email_verified', coalesce(v_cp.email_verified, false),
    'whatsapp_verified', coalesce(v_cp.whatsapp_verified, false),
    'has_cv', coalesce(v_has_cv, false),
    'certificate_count', coalesce(v_cert_count, 0),
    'smc', v_smc,
    'assessment_active', EXISTS (SELECT 1 FROM public.smc_assessments s
        WHERE s.crew_profile_id = v_uid AND s.completed_at IS NULL AND s.started_at > now() - interval '24 hours'),
    'pending_interviews', (SELECT count(*) FROM public.interview_invites i WHERE i.crew_profile_id = v_uid AND i.completed_at IS NULL),
    'application_count', (SELECT count(*) FROM public.job_applications j WHERE j.crew_id = v_uid),
    'open_ticket_count', (SELECT count(*) FROM public.support_tickets t WHERE t.user_id = v_uid AND t.status NOT IN ('RESOLVED','CLOSED'))
  );
END $$;
REVOKE ALL ON FUNCTION public.dora_get_my_context() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dora_get_my_context() TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';