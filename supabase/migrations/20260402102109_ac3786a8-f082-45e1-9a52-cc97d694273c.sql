
DROP POLICY "Anyone can view public profile info" ON public.profiles;

CREATE POLICY "Anyone can view public profile info"
ON public.profiles
FOR SELECT
TO public
USING (true);
