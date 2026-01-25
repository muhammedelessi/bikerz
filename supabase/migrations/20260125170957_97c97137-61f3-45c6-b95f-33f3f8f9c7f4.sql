-- Add RLS policy to allow admins to manage all courses
CREATE POLICY "Admins can manage all courses" 
ON public.courses 
FOR ALL 
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Also add admin view policy for unpublished courses
CREATE POLICY "Admins can view all courses" 
ON public.courses 
FOR SELECT 
USING (is_admin(auth.uid()));