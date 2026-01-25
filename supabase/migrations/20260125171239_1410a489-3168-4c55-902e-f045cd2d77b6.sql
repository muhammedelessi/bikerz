-- Add RLS policy to allow admins to manage all chapters
CREATE POLICY "Admins can manage all chapters" 
ON public.chapters 
FOR ALL 
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Add admin view policy for unpublished chapters
CREATE POLICY "Admins can view all chapters" 
ON public.chapters 
FOR SELECT 
USING (is_admin(auth.uid()));