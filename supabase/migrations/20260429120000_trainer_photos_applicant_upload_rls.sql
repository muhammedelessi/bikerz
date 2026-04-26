-- Applicants upload profile photos during "apply as trainer" to trainer-photos/applications/{user_id}/...
-- Existing policies only allow admins; authenticated users need INSERT on their own prefix.

DROP POLICY IF EXISTS "Users can upload own trainer application photos" ON storage.objects;

CREATE POLICY "Users can upload own trainer application photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'trainer-photos'
  AND (storage.foldername(name))[1] = 'applications'
  AND (storage.foldername(name))[2] = (SELECT auth.uid())::text
);
