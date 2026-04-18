-- Add bike_entries jsonb column to profiles for multi-bike support.
-- bike_entries stores an array of BikeEntry objects with type, subtype,
-- brand, model, custom flags, and photo URLs.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bike_entries jsonb DEFAULT '[]'::jsonb;
