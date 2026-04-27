-- Persist garage JSON and optional languages JSON on trainer applications (admin detail + review).
ALTER TABLE public.trainer_applications
  ADD COLUMN IF NOT EXISTS bike_entries jsonb,
  ADD COLUMN IF NOT EXISTS languages jsonb;

COMMENT ON COLUMN public.trainer_applications.bike_entries IS 'Garage snapshot at apply time (same shape as profiles.bike_entries).';
COMMENT ON COLUMN public.trainer_applications.languages IS 'Optional structured language rows at apply time.';
