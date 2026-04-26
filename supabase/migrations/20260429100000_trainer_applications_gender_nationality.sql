-- Optional demographics on trainer applications (filled on apply when missing from profile).
ALTER TABLE public.trainer_applications
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS nationality text;

COMMENT ON COLUMN public.trainer_applications.gender IS 'Applicant gender when not already on profile (e.g. Male/Female/Other).';
COMMENT ON COLUMN public.trainer_applications.nationality IS 'ISO 3166-1 alpha-2 nationality country code when not on profile.';
