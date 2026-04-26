-- Allow authenticated users to upload their own trainer application photo
-- under the path: applications/{user_id}/...
CREATE POLICY "Users can upload own trainer application photo"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'trainer-photos'
  AND (storage.foldername(name))[1] = 'applications'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Also allow them to update/replace it (in case re-applying after rejection)
CREATE POLICY "Users can update own trainer application photo"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'trainer-photos'
  AND (storage.foldername(name))[1] = 'applications'
  AND (storage.foldername(name))[2] = auth.uid()::text
);
