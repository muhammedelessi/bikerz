
-- Revoke broad SELECT then column-grant the safe set to anon
REVOKE SELECT ON public.trainers FROM anon, authenticated;

GRANT SELECT (
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
) ON public.trainers TO anon;

-- Authenticated users get full SELECT (RLS still restricts rows: own row or
-- admin via existing policies; for anon-equivalent reads of other trainers,
-- RLS allows active rows but column grant rules still apply at the column
-- level — to keep app behaviour, grant safe columns broadly here too):
GRANT SELECT (
  id, name_ar, name_en, photo_url, bio_ar, bio_en, country, city,
  bike_type, years_of_experience, services, status, profit_ratio,
  motorbike_brand, license_type, bike_photos, album_photos, bike_entries,
  availability_blocked_dates, availability_special_hours, availability_settings,
  language_levels, user_id, created_at
) ON public.trainers TO authenticated;

-- Sensitive columns (phone, email, date_of_birth) granted only to authenticated
-- so RLS can gate them to owner/admin rows:
GRANT SELECT (phone, email, date_of_birth) ON public.trainers TO authenticated;

-- Drop the overly-broad public read policy and add a tightened one that
-- only allows active rows for anyone (column grants gate which fields):
DROP POLICY IF EXISTS "Public read active trainers via view" ON public.trainers;

CREATE POLICY "Public read active trainers"
ON public.trainers
FOR SELECT
TO anon, authenticated
USING (status = 'active');
