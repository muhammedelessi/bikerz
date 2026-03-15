ALTER TABLE public.course_country_prices 
ADD COLUMN original_price numeric NOT NULL DEFAULT 0,
ADD COLUMN discount_percentage numeric NOT NULL DEFAULT 0;