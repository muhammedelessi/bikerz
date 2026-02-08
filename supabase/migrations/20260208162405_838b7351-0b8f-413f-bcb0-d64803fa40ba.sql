-- Create storage bucket for course thumbnails
INSERT INTO storage.buckets (id, name, public)
VALUES ('course-thumbnails', 'course-thumbnails', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated admins to upload thumbnails
CREATE POLICY "Admins can upload course thumbnails"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'course-thumbnails' 
  AND is_admin(auth.uid())
);

-- Allow admins to update thumbnails
CREATE POLICY "Admins can update course thumbnails"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'course-thumbnails' 
  AND is_admin(auth.uid())
);

-- Allow admins to delete thumbnails
CREATE POLICY "Admins can delete course thumbnails"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'course-thumbnails' 
  AND is_admin(auth.uid())
);

-- Allow public read access for thumbnails
CREATE POLICY "Anyone can view course thumbnails"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'course-thumbnails');