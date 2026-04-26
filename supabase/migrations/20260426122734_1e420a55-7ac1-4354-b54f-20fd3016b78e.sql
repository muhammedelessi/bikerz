
ALTER TABLE public.trainer_applications
  ADD COLUMN IF NOT EXISTS bike_type text,
  ADD COLUMN IF NOT EXISTS bio text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS name_ar text,
  ADD COLUMN IF NOT EXISTS name_en text,
  ADD COLUMN IF NOT EXISTS services text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS years_of_experience integer,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS nationality text;

-- Backfill years_of_experience from existing experience_years column where present
UPDATE public.trainer_applications
SET years_of_experience = experience_years
WHERE years_of_experience IS NULL AND experience_years IS NOT NULL;
