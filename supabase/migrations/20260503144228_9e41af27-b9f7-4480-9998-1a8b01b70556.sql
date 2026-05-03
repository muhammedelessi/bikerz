CREATE POLICY "Users can enroll themselves"
ON public.course_enrollments
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);