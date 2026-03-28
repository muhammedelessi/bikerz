
CREATE TABLE public.hero_slides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  position INTEGER NOT NULL DEFAULT 0,
  image_url TEXT NOT NULL,
  headline_en TEXT,
  headline_ar TEXT,
  subtitle_en TEXT,
  subtitle_ar TEXT,
  cta_text_en TEXT,
  cta_text_ar TEXT,
  cta_link TEXT DEFAULT '/courses',
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.hero_slides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published hero slides"
  ON public.hero_slides FOR SELECT
  USING (is_published = true);

CREATE POLICY "Admins can manage hero slides"
  ON public.hero_slides FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
