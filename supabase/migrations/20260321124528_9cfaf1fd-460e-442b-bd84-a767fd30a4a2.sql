
CREATE OR REPLACE FUNCTION public.get_auth_providers(p_email text)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'has_email', EXISTS (
      SELECT 1 FROM auth.identities i
      JOIN auth.users u ON u.id = i.user_id
      WHERE u.email = p_email AND i.provider = 'email'
    ),
    'has_google', EXISTS (
      SELECT 1 FROM auth.identities i
      JOIN auth.users u ON u.id = i.user_id
      WHERE u.email = p_email AND i.provider = 'google'
    ),
    'exists', EXISTS (
      SELECT 1 FROM auth.users u WHERE u.email = p_email
    )
  )
$$;
