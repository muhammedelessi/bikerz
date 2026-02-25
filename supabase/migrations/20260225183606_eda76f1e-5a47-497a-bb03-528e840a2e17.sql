
-- Allow admins to read all lesson_progress for dashboard stats
CREATE POLICY "Admins can view all lesson progress"
ON public.lesson_progress
FOR SELECT
USING (is_admin(auth.uid()));

-- Allow admins to read all course_enrollments for dashboard stats
CREATE POLICY "Admins can view all enrollments"
ON public.course_enrollments
FOR SELECT
USING (is_admin(auth.uid()));
