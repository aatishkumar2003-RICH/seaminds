-- Create crew-cvs storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('crew-cvs', 'crew-cvs', false)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to upload CVs (profiles are created without auth in this app)
CREATE POLICY "Anyone can upload crew CVs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'crew-cvs');

-- Allow reading own CVs by path pattern (profile_id prefix)
CREATE POLICY "Anyone can read crew CVs"
ON storage.objects FOR SELECT
USING (bucket_id = 'crew-cvs');