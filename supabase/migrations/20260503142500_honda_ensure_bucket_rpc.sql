-- Honda Owners — RPC fallback to ensure the storage bucket exists.
--
-- Why this exists:
--   On managed Supabase environments the storage portion of an SQL
--   migration occasionally doesn't land (we observed "Bucket not found"
--   reaching end users). The previous defensive migration helps but
--   still depends on Lovable's deploy pipeline picking up the SQL file.
--   This RPC removes that dependency: the frontend can call it just
--   before uploading, and a SECURITY DEFINER guarantee ensures the
--   creation succeeds regardless of the caller's role.
--
-- Idempotency:
--   ON CONFLICT DO NOTHING — calling the function 1000 times in a row
--   does nothing on subsequent calls. Cheap to call from the client
--   on every upload as a pre-flight check.
--
-- Security:
--   GRANTed to authenticated only; an anon client cannot create
--   buckets via this function. The function is hardcoded to a single
--   bucket id — there's no user-controlled input — so there's no risk
--   of arbitrary bucket creation.

CREATE OR REPLACE FUNCTION public.ensure_honda_storage_bucket()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('honda-registrations', 'honda-registrations', false)
  ON CONFLICT (id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_honda_storage_bucket() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_honda_storage_bucket() TO authenticated;

-- Reload PostgREST so the function is callable via supabase.rpc()
-- without a server restart.
NOTIFY pgrst, 'reload schema';
