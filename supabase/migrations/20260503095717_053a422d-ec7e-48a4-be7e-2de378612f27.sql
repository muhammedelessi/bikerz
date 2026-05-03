
-- 1) lessons_public view: masks video_url for non-free lessons unless user is enrolled or admin/mentor
CREATE OR REPLACE VIEW public.lessons_public
WITH (security_invoker = on) AS
SELECT
  l.id,
  l.chapter_id,
  l.title,
  l.title_ar,
  l.description,
  l.description_ar,
  CASE
    WHEN l.is_free = true THEN l.video_url
    WHEN auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.chapters ch
      JOIN public.course_enrollments ce
        ON ce.course_id = ch.course_id
       AND ce.user_id = auth.uid()
      WHERE ch.id = l.chapter_id
    ) THEN l.video_url
    WHEN public.is_admin(auth.uid()) THEN l.video_url
    ELSE NULL
  END AS video_url,
  l.duration_minutes,
  l.position,
  l.is_published,
  l.is_free,
  l.created_at,
  l.updated_at,
  l.video_provider,
  l.video_thumbnail,
  CASE
    WHEN l.is_free = true THEN l.content_html
    WHEN auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.chapters ch
      JOIN public.course_enrollments ce
        ON ce.course_id = ch.course_id
       AND ce.user_id = auth.uid()
      WHERE ch.id = l.chapter_id
    ) THEN l.content_html
    WHEN public.is_admin(auth.uid()) THEN l.content_html
    ELSE NULL
  END AS content_html,
  CASE
    WHEN l.is_free = true THEN l.content_html_ar
    WHEN auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1
      FROM public.chapters ch
      JOIN public.course_enrollments ce
        ON ce.course_id = ch.course_id
       AND ce.user_id = auth.uid()
      WHERE ch.id = l.chapter_id
    ) THEN l.content_html_ar
    WHEN public.is_admin(auth.uid()) THEN l.content_html_ar
    ELSE NULL
  END AS content_html_ar
FROM public.lessons l
JOIN public.chapters ch ON ch.id = l.chapter_id
JOIN public.courses c ON c.id = ch.course_id
WHERE l.is_published = true AND ch.is_published = true AND c.is_published = true;

GRANT SELECT ON public.lessons_public TO anon, authenticated;

-- 2) Lock base lesson_activities & test_questions SELECT to admins/mentors;
--    client reads must go through the existing _student views.
DROP POLICY IF EXISTS "Authenticated can view published activities" ON public.lesson_activities;
CREATE POLICY "Admins can view activities"
  ON public.lesson_activities FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view published test questions" ON public.test_questions;
CREATE POLICY "Admins can view test questions (base table)"
  ON public.test_questions FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));
