CREATE TABLE public.profile_view_links (
  token text PRIMARY KEY DEFAULT encode(extensions.gen_random_bytes(18),'hex'),
  application_id uuid NOT NULL,
  crew_id uuid NOT NULL,
  recipient_email text,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days',
  view_count integer NOT NULL DEFAULT 0,
  last_viewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (application_id)
);
GRANT ALL ON public.profile_view_links TO service_role;
ALTER TABLE public.profile_view_links ENABLE ROW LEVEL SECURITY;

-- Passwordless employer view: only for crew who applied to that employer, link expires in 30 days.
CREATE OR REPLACE FUNCTION public.get_crew_card_by_link(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.profile_view_links; r jsonb;
BEGIN
  SELECT * INTO l FROM public.profile_view_links WHERE token = p_token AND expires_at > now();
  IF NOT FOUND THEN RETURN jsonb_build_object('error','expired'); END IF;
  UPDATE public.profile_view_links SET view_count = view_count + 1, last_viewed_at = now() WHERE token = p_token;
  SELECT jsonb_build_object(
    'tier','full','via_link',true,
    'first_name', cp.first_name,
    'last_initial', left(coalesce(cp.last_name,''),1),
    'role', coalesce(cp.rank, cp.role),
    'nationality', cp.nationality,
    'years_in_rank_band', cp.years_in_rank_band,
    'contracts_in_rank_band', cp.contracts_in_rank_band,
    'total_sea_service_band', cp.total_sea_service_band,
    'is_available', coalesce(cp.is_available,false),
    'contact_email', cp.email,
    'contact_whatsapp', cp.whatsapp_number,
    'vessel_families', coalesce((SELECT jsonb_agg(jsonb_build_object('vessel_family', ve.vessel_family,'sea_time_band', ve.sea_time_band))
       FROM public.crew_vessel_experience ve WHERE ve.crew_id = cp.id),'[]'::jsonb),
    'score', (SELECT jsonb_build_object('overall_score', sa.overall_score,'score_band', sa.score_band,'certificate_id', sa.certificate_id,'completed_at', sa.completed_at)
       FROM public.smc_assessments sa WHERE sa.crew_profile_id = cp.id AND sa.status='completed'
       ORDER BY sa.completed_at DESC NULLS LAST LIMIT 1),
    'claims', coalesce((SELECT jsonb_agg(jsonb_build_object('claim_key', cc.claim_key,'status', cc.status))
       FROM public.crew_claims cc WHERE cc.crew_id = cp.id),'[]'::jsonb)
  ) INTO r
  FROM public.crew_profiles cp
  JOIN public.job_applications ja ON ja.id = l.application_id AND ja.crew_id = cp.id
  WHERE cp.id = l.crew_id;
  RETURN coalesce(r, jsonb_build_object('error','expired'));
END $$;
REVOKE ALL ON FUNCTION public.get_crew_card_by_link(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_crew_card_by_link(text) TO anon, authenticated;

-- Auto-index agency identity/contacts from every ingested vacancy.
CREATE OR REPLACE FUNCTION public.index_company_contact()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n text := nullif(trim(NEW.company_name),'');
BEGIN
  IF n IS NULL OR length(n) < 3 OR (NEW.contact_email IS NULL AND NEW.contact_whatsapp IS NULL) THEN RETURN NEW; END IF;
  IF lower(n) IN ('confidential','not specified','unknown','n/a','company') THEN RETURN NEW; END IF;
  UPDATE public.company_contacts SET
    crewing_email = coalesce(crewing_email, NEW.contact_email),
    whatsapp = coalesce(whatsapp, NEW.contact_whatsapp),
    website = coalesce(website, NEW.company_website)
  WHERE lower(company_name) = lower(n) OR lower(n) = ANY (SELECT lower(a) FROM unnest(coalesce(company_aliases,'{}')) a);
  IF NOT FOUND THEN
    INSERT INTO public.company_contacts(company_name, crewing_email, whatsapp, website, verified)
    VALUES (n, NEW.contact_email, NEW.contact_whatsapp, NEW.company_website, false);
  END IF;
  RETURN NEW;
EXCEPTION WHEN others THEN RETURN NEW;
END $$;
CREATE TRIGGER trg_index_company_contact AFTER INSERT ON public.external_vacancies
FOR EACH ROW EXECUTE FUNCTION public.index_company_contact();

NOTIFY pgrst, 'reload schema';