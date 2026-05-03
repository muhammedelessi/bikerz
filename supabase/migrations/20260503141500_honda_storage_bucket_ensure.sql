-- Honda Owners — defensive bucket-and-policies recreation.
--
-- Why this exists despite the previous migration:
--   The original honda_owners_program migration created the
--   `honda-registrations` storage bucket alongside the table.
--   Reports came back with "Bucket not found" on first upload, which
--   means the storage portion either didn't run or got partially
--   rolled back on the target environment. This migration is purely
--   the storage layer, fully idempotent, and re-runs the bucket +
--   policies in a transaction so it lands as a unit.
--
-- Idempotency guarantees:
--   - INSERT … ON CONFLICT DO NOTHING for the bucket row
--   - DROP POLICY IF EXISTS … then CREATE POLICY for each policy
--   - No data is destroyed; existing files (if any) are untouched.

-- ─────────────────────────────────────────────────────────────────────
-- 1) Create the bucket if it doesn't exist
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('honda-registrations', 'honda-registrations', false)
ON CONFLICT (id) DO NOTHING;

-- Sanity assertion: if the INSERT was a no-op AND the bucket somehow
-- still doesn't exist, raise a hard error so the migration fails loudly
-- instead of silently leaving the app broken.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'honda-registrations'
  ) THEN
    RAISE EXCEPTION
      'honda-registrations bucket missing after INSERT — check storage.buckets permissions';
  END IF;
END
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 2) Re-create policies — each DROP IF EXISTS makes this safe to re-run
-- ─────────────────────────────────────────────────────────────────────
-- Owner can upload to their own folder ({user_id}/...).
DROP POLICY IF EXISTS "honda_storage_insert_own" ON storage.objects;
CREATE POLICY "honda_storage_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'honda-registrations'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owner can read their own files.
DROP POLICY IF EXISTS "honda_storage_select_own" ON storage.objects;
CREATE POLICY "honda_storage_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'honda-registrations'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owner can update their own files (e.g. re-upload after AI rejection).
DROP POLICY IF EXISTS "honda_storage_update_own" ON storage.objects;
CREATE POLICY "honda_storage_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'honda-registrations'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'honda-registrations'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owner can delete their own pending uploads (cleanup if they abandon
-- the form before submitting). Files referenced by an approved
-- application stay because the FK isn't directly enforced; the admin
-- UI keeps showing the latest path on file.
DROP POLICY IF EXISTS "honda_storage_delete_own" ON storage.objects;
CREATE POLICY "honda_storage_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'honda-registrations'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Admin can read everything (signed URLs in the admin Honda Owners panel).
DROP POLICY IF EXISTS "honda_storage_admin_select_all" ON storage.objects;
CREATE POLICY "honda_storage_admin_select_all" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'honda-registrations'
    AND public.has_role(auth.uid(), 'admin')
  );

-- Reload PostgREST so any new policies are picked up immediately.
NOTIFY pgrst, 'reload schema';
