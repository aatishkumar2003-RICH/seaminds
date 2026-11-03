CREATE TABLE public.crew_dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL DEFAULT auth.uid(),
  author_first_name text,
  author_rank text,
  author_vessel_type text,
  author_nationality text,
  category text NOT NULL DEFAULT 'life_at_sea',
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  photo_path text,
  youtube_url text,
  confidentiality_confirmed boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'published',
  salute_count int NOT NULL DEFAULT 0,
  anchor_count int NOT NULL DEFAULT 0,
  like_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dispatch_category_chk CHECK (category IN ('engine','bridge','cargo','life_at_sea','port_call','cadet_prep')),
  CONSTRAINT dispatch_status_chk CHECK (status IN ('published','hidden')),
  CONSTRAINT dispatch_title_len CHECK (char_length(title) BETWEEN 3 AND 120),
  CONSTRAINT dispatch_body_len CHECK (char_length(body) <= 3000),
  CONSTRAINT dispatch_youtube_chk CHECK (youtube_url IS NULL OR youtube_url ~* '^https://(www\.|m\.)?(youtube\.com|youtu\.be)/')
);
CREATE INDEX crew_dispatches_feed_idx ON public.crew_dispatches (status, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.crew_dispatches TO authenticated;
GRANT ALL ON public.crew_dispatches TO service_role;
ALTER TABLE public.crew_dispatches ENABLE ROW LEVEL SECURITY;

CREATE POLICY dispatches_read ON public.crew_dispatches FOR SELECT TO authenticated
  USING (status = 'published' OR author_id = auth.uid());
CREATE POLICY dispatches_insert_own ON public.crew_dispatches FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND confidentiality_confirmed);
CREATE POLICY dispatches_delete_own ON public.crew_dispatches FOR DELETE TO authenticated
  USING (author_id = auth.uid());

-- Server-side snapshot of author identity; client cannot forge rank/counts/status
CREATE OR REPLACE FUNCTION public.crew_dispatch_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p record; recent int;
BEGIN
  NEW.author_id := auth.uid();
  IF NEW.author_id IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  SELECT count(*) INTO recent FROM crew_dispatches WHERE author_id = NEW.author_id AND created_at > now() - interval '1 day';
  IF recent >= 5 THEN RAISE EXCEPTION 'Daily limit reached (5 dispatches per day)'; END IF;
  IF NEW.photo_path IS NOT NULL AND split_part(NEW.photo_path, '/', 1) <> NEW.author_id::text THEN
    RAISE EXCEPTION 'Invalid photo';
  END IF;
  SELECT first_name, rank, vessel_type, nationality INTO p FROM crew_profiles WHERE id = NEW.author_id;
  NEW.author_first_name := p.first_name; NEW.author_rank := p.rank;
  NEW.author_vessel_type := p.vessel_type; NEW.author_nationality := p.nationality;
  NEW.status := 'published'; NEW.salute_count := 0; NEW.anchor_count := 0; NEW.like_count := 0;
  NEW.created_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_crew_dispatch_guard BEFORE INSERT ON public.crew_dispatches
  FOR EACH ROW EXECUTE FUNCTION public.crew_dispatch_guard();

CREATE POLICY dispatch_photos_upload_own ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'crew-dispatches' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY dispatch_photos_delete_own ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'crew-dispatches' AND (storage.foldername(name))[1] = auth.uid()::text);