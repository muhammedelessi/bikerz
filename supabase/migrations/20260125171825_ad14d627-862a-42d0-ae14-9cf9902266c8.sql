-- Create storage bucket for lesson videos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lesson-videos', 
  'lesson-videos', 
  true,
  524288000, -- 500MB limit
  ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska']
);

-- Create storage policies for lesson videos bucket
CREATE POLICY "Anyone can view lesson videos"
ON storage.objects FOR SELECT
USING (bucket_id = 'lesson-videos');

CREATE POLICY "Admins can upload lesson videos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'lesson-videos' 
  AND is_admin(auth.uid())
);

CREATE POLICY "Admins can update lesson videos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'lesson-videos' AND is_admin(auth.uid()));

CREATE POLICY "Admins can delete lesson videos"
ON storage.objects FOR DELETE
USING (bucket_id = 'lesson-videos' AND is_admin(auth.uid()));

-- Add RLS policy to allow admins to manage all lessons
CREATE POLICY "Admins can manage all lessons" 
ON public.lessons 
FOR ALL 
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Add admin view policy for unpublished lessons
CREATE POLICY "Admins can view all lessons" 
ON public.lessons 
FOR SELECT 
USING (is_admin(auth.uid()));