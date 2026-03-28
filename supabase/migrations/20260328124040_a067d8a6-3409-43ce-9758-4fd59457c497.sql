
-- Create hero_ads table for ad management
CREATE TABLE public.hero_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  target_url text NOT NULL DEFAULT '/courses',
  is_active boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  image_desktop_en text,
  image_desktop_ar text,
  image_mobile_en text,
  image_mobile_ar text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.hero_ads ENABLE ROW LEVEL SECURITY;

-- Admins can manage ads
CREATE POLICY "Admins can manage hero ads"
  ON public.hero_ads
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Anyone can view active ads
CREATE POLICY "Anyone can view active hero ads"
  ON public.hero_ads
  FOR SELECT
  TO public
  USING (is_active = true);

-- Create storage bucket for ad images
INSERT INTO storage.buckets (id, name, public)
VALUES ('hero-ads', 'hero-ads', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for hero-ads bucket
CREATE POLICY "Anyone can view ad images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'hero-ads');

CREATE POLICY "Admins can upload ad images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'hero-ads' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins can update ad images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'hero-ads' AND public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete ad images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'hero-ads' AND public.is_admin(auth.uid()));
