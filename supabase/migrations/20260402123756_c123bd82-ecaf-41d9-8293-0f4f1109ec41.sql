CREATE POLICY "Admins can manage all enrollments"
ON public.course_enrollments
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));