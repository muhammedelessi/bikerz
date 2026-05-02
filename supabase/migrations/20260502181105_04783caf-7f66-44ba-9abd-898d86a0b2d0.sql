
DROP VIEW IF EXISTS public.public_trainers;

CREATE VIEW public.public_trainers
WITH (security_invoker = true)
AS
SELECT
  id,
  name_ar,
  name_en,
  photo_url,
  bio_ar,
  bio_en,
  country,
  city,
  bike_type,
  years_of_experience,
  services,
  status,
  profit_ratio,
  motorbike_brand,
  license_type,
  bike_photos,
  album_photos,
  bike_entries,
  availability_blocked_dates,
  availability_special_hours,
  availability_settings,
  language_levels,
  user_id,
  created_at
FROM public.trainers
WHERE status = 'active';

GRANT SELECT ON public.public_trainers TO anon, authenticated;

-- Public read policy on trainers limited to active rows for use through the view
CREATE POLICY "Public read active trainers via view"
ON public.trainers
FOR SELECT
TO anon, authenticated
USING (status = 'active');
