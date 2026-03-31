
-- Allow admins to insert new mentors
CREATE POLICY "Admins can insert mentors"
ON public.mentors
FOR INSERT
TO public
WITH CHECK (is_admin(auth.uid()));

-- Allow admins to delete mentors
CREATE POLICY "Admins can delete mentors"
ON public.mentors
FOR DELETE
TO public
USING (is_admin(auth.uid()));

-- Allow admins to view all mentors (including unavailable)
CREATE POLICY "Admins can view all mentors"
ON public.mentors
FOR SELECT
TO public
USING (is_admin(auth.uid()));

-- Allow admins to update any mentor
CREATE POLICY "Admins can update all mentors"
ON public.mentors
FOR UPDATE
TO public
USING (is_admin(auth.uid()));
