-- Expose trainer contact info (email + phone) on the public_trainers view.
--
-- Context:
--   The original view (20260502181105) deliberately omitted email/phone
--   to keep PII off the anon role. The product decision has changed:
--   trainees should be able to contact trainers directly from public
--   trainer profiles, so these fields are now part of the public surface.
--
-- Risk surface:
--   • Low — both fields are already returned by the trainers table to
--     authenticated users via row-level policies, and admins manage them.
--   • Email/phone harvesting by anon is the main concern; mitigated by
--     keeping the view filtered to status='active' (so deactivated
--     trainers' contact info disappears) and by the existing rate
--     limits / abuse monitoring at the API gateway.
--
-- Reversibility:
--   The view is recreated, not the underlying table. To revert, drop
--   email + phone from the SELECT in a follow-up migration.

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
  email,                         -- newly exposed
  phone,                         -- newly exposed
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

-- Re-apply the same security posture as the previous version: this view
-- is consumed by anon + authenticated, but uses security_invoker = false
-- so the underlying table's RLS policies don't second-guess the public
-- access intent encoded in the WHERE clause above.
ALTER VIEW public.public_trainers SET (security_invoker = off);
GRANT SELECT ON public.public_trainers TO anon, authenticated;
