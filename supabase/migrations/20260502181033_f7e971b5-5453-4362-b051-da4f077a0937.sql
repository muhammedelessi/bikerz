
-- ============================================================
-- 1) PROFILES: remove blanket public SELECT, add safe public view
-- ============================================================
DROP POLICY IF EXISTS "Anyone can view public profile info" ON public.profiles;

-- Public-safe view exposing only non-sensitive fields used in UI
-- (leaderboards, ratings, public rider info)
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = true)
AS
SELECT
  user_id,
  full_name,
  avatar_url,
  rider_nickname,
  experience_level,
  riding_experience_years,
  bike_brand,
  bike_model,
  engine_size_cc,
  km_logged,
  courses_sold_count,
  rank_override,
  created_at
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- New scoped public SELECT policy on the underlying table:
-- expose only safe columns implicitly via the view; restrict raw table SELECT
-- to owner/admin (already covered by existing policies).
-- (No new public policy needed — the view uses SECURITY INVOKER + grant.)

-- Allow the view itself to read the table by adding a column-agnostic but
-- minimally permissive policy used only when accessed through grants.
-- Use a dedicated policy that filters to the safe column set is not possible
-- in PG RLS, so instead we add a permissive SELECT policy and rely on the
-- view's SELECT list. We make it permissive only for view-readable rows:
CREATE POLICY "Public can read profiles via safe view"
ON public.profiles
FOR SELECT
TO anon, authenticated
USING (true);

-- NOTE: The above re-enables broad row read, but column exposure is
-- controlled at the application/view layer. To truly restrict columns we
-- revoke direct SELECT on the table for anon/authenticated and only grant
-- on the view.
REVOKE SELECT ON public.profiles FROM anon;
REVOKE SELECT ON public.profiles FROM authenticated;
-- Owner & admin policies still apply because they use auth.uid(); but those
-- require SELECT grant. Re-grant to authenticated so RLS-protected SELECT
-- (own row / admin) keeps working:
GRANT SELECT ON public.profiles TO authenticated;
-- And drop the broad public policy we just added — owner/admin policies are sufficient
DROP POLICY IF EXISTS "Public can read profiles via safe view" ON public.profiles;

-- ============================================================
-- 2) TRAINERS: restrict raw table to admin/owner; expose safe public view
-- ============================================================
DROP POLICY IF EXISTS "Anyone can view active trainers" ON public.trainers;

CREATE POLICY "Owners can view their trainer row"
ON public.trainers
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Public-safe view (no phone/email/date_of_birth)
CREATE OR REPLACE VIEW public.public_trainers
WITH (security_invoker = false)
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

-- ============================================================
-- 3) TRAINING_BOOKINGS: drop public PII policy
-- (use existing SECURITY DEFINER function get_trainer_booked_slots instead)
-- ============================================================
DROP POLICY IF EXISTS "Public read trainer slot occupancy for scheduling" ON public.training_bookings;

GRANT EXECUTE ON FUNCTION public.get_trainer_booked_slots(uuid, date, date) TO anon, authenticated;

-- ============================================================
-- 4) GUEST_VIDEO_VIEWS: enable RLS, admin-only SELECT, allow inserts from anyone
-- ============================================================
ALTER TABLE public.guest_video_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view guest video views"
ON public.guest_video_views
FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

CREATE POLICY "Anyone can insert guest video views"
ON public.guest_video_views
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- ============================================================
-- 5) LESSON-VIDEOS bucket: make private (videos are served via Bunny Stream)
-- ============================================================
UPDATE storage.buckets SET public = false WHERE id = 'lesson-videos';

DROP POLICY IF EXISTS "Anyone can view lesson videos" ON storage.objects;

CREATE POLICY "Admins can view lesson videos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'lesson-videos' AND is_admin(auth.uid()));
