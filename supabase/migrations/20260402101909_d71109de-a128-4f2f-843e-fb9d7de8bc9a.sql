CREATE POLICY "Anyone can view public profile info"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);