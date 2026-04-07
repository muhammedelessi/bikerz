ALTER TABLE public.course_country_prices 
ADD COLUMN IF NOT EXISTS vat_percentage numeric NOT NULL DEFAULT 15,
ADD COLUMN IF NOT EXISTS final_price_with_vat numeric NOT NULL DEFAULT 0;