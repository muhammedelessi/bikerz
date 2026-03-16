ALTER TABLE public.courses ADD COLUMN base_review_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.courses ADD COLUMN base_rating numeric NOT NULL DEFAULT 0;