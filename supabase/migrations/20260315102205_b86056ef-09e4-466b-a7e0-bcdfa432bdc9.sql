
CREATE TABLE public.course_country_prices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'SAR',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(course_id, country_code)
);

ALTER TABLE public.course_country_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage country prices"
  ON public.course_country_prices
  FOR ALL
  TO public
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Anyone can view country prices"
  ON public.course_country_prices
  FOR SELECT
  TO public
  USING (true);
