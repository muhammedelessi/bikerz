
-- 1) PROFILES: drop the public-readable-all-columns policy.
--    Use the security-definer view `public_profiles` (already excludes PII) for public reads.
DROP POLICY IF EXISTS "Public can read profiles (column-restricted)" ON public.profiles;

ALTER VIEW public.public_profiles SET (security_invoker = off);
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- 2) TRAINERS: drop the broad public-active policy that exposed phone/email/dob.
--    Public consumers must use `public_trainers` view (no PII).
DROP POLICY IF EXISTS "Public read active trainers" ON public.trainers;

ALTER VIEW public.public_trainers SET (security_invoker = off);
GRANT SELECT ON public.public_trainers TO anon, authenticated;

-- 3) COUPONS: restrict catalog SELECT to authenticated users only.
--    The promo banner uses an Edge Function with the service role.
DROP POLICY IF EXISTS "Users can view active non-deleted coupons" ON public.coupons;
CREATE POLICY "Authenticated can view active coupons"
  ON public.coupons FOR SELECT
  TO authenticated
  USING (status = 'active' AND is_deleted = false AND expiry_date > now() AND start_date <= now());

-- 4) LESSON_ACTIVITIES: stop exposing the JSONB (with correct_answers) to anon.
--    Frontend already reads from the safe view `lesson_activities_student`.
DROP POLICY IF EXISTS "Anyone can view published activities" ON public.lesson_activities;
CREATE POLICY "Authenticated can view published activities"
  ON public.lesson_activities FOR SELECT
  TO authenticated
  USING (is_published = true OR public.is_admin(auth.uid()));

ALTER VIEW public.lesson_activities_student SET (security_invoker = off);
GRANT SELECT ON public.lesson_activities_student TO anon, authenticated;

-- 5) TEST_QUESTIONS_STUDENT view also exposed via security_invoker; keep server-side enforcement
ALTER VIEW public.test_questions_student SET (security_invoker = off);
GRANT SELECT ON public.test_questions_student TO authenticated;

-- 6) Fix function with mutable search_path
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

-- 7) Tighten "always true" policies on writable tables
DROP POLICY IF EXISTS "Service role full access" ON public.user_course_statuses;
CREATE POLICY "Service role full access"
  ON public.user_course_statuses FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- community_members + guest_video_views INSERT-with-check(true) are intentional public-insert
-- endpoints; left as-is by design.

-- 8) Lock down SECURITY DEFINER helpers that should not be callable directly by clients.
--    These are called only by other SECURITY DEFINER functions or triggers.
REVOKE EXECUTE ON FUNCTION public.add_xp_secure(integer, text, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.award_badge_secure(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_coupon_usage(uuid, uuid, uuid, text, text, numeric, numeric, numeric) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.upsert_course_status(uuid, uuid, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_all_user_emails() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_email_by_phone(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_and_apply_coupon(text, uuid, uuid, numeric) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trainer_applications_on_approved() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trainer_applications_notify_admins() FROM anon, authenticated;
