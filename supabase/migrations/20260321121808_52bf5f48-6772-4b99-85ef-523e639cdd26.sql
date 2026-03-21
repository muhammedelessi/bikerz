CREATE OR REPLACE FUNCTION public.check_google_provider(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.identities i
    JOIN auth.users u ON u.id = i.user_id
    WHERE u.email = p_email
      AND i.provider = 'google'
  )
$$;