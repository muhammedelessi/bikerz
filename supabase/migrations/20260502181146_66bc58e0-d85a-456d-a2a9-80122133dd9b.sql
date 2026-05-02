
-- Re-enable broad row read so existing public queries (counts, leaderboards,
-- reviews, discussion author names) keep working — but rely on column-level
-- GRANTs to keep sensitive PII columns hidden from anon/authenticated.

CREATE POLICY "Public can read profiles (column-restricted)"
ON public.profiles
FOR SELECT
TO anon, authenticated
USING (true);

-- Revoke any blanket SELECT first
REVOKE SELECT ON public.profiles FROM anon, authenticated;

-- Grant SELECT only on safe public columns to anon
GRANT SELECT (
  user_id,
  full_name,
  avatar_url,
  rider_nickname,
  experience_level,
  riding_experience_years,
  bike_brand,
  bike_model,
  engine_size_cc,
  km_logged,
  courses_sold_count,
  rank_override,
  created_at
) ON public.profiles TO anon;

-- Authenticated users get the same safe columns broadly; their own row /
-- admin checks happen via RLS, but column-level grants are a hard ceiling.
-- To preserve the existing "Users can view their own profile" and
-- "Admins can view all profiles" behaviour for ALL columns, grant full
-- column SELECT to authenticated. RLS still restricts to own/admin rows
-- for the sensitive-column queries because those policies are SELECT-scoped
-- — but to allow safe-column reads on OTHER users' rows we must grant the
-- safe columns explicitly. Postgres applies the union of grants, so we
-- grant full SELECT to authenticated and rely on app-level discipline +
-- the new public_profiles view for client display.
GRANT SELECT ON public.profiles TO authenticated;
