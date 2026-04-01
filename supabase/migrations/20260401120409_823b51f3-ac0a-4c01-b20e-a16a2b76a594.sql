
ALTER TABLE public.trainings ADD COLUMN background_image text DEFAULT NULL;

INSERT INTO storage.buckets (id, name, public) VALUES ('training-images', 'training-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view training images" ON storage.objects FOR SELECT USING (bucket_id = 'training-images');
CREATE POLICY "Admins can upload training images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'training-images' AND is_admin(auth.uid()));
CREATE POLICY "Admins can update training images" ON storage.objects FOR UPDATE USING (bucket_id = 'training-images' AND is_admin(auth.uid()));
CREATE POLICY "Admins can delete training images" ON storage.objects FOR DELETE USING (bucket_id = 'training-images' AND is_admin(auth.uid()));
