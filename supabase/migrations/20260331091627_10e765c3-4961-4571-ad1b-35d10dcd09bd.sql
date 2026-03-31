
CREATE OR REPLACE FUNCTION public.get_all_user_emails()
RETURNS TABLE(user_id uuid, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT u.id AS user_id, u.email::text
  FROM auth.users u
  WHERE EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = (SELECT auth.uid())
      AND ur.role IN ('super_admin', 'academy_admin')
  )
$$;
