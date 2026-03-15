
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS slug text UNIQUE,
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en';
