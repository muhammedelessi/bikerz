ALTER TABLE public.trainer_applications
ADD COLUMN IF NOT EXISTS bike_entries JSONB NOT NULL DEFAULT '[]'::jsonb;