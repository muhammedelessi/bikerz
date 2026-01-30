-- Add rider profile extension fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS rider_nickname TEXT,
ADD COLUMN IF NOT EXISTS bike_brand TEXT,
ADD COLUMN IF NOT EXISTS bike_model TEXT,
ADD COLUMN IF NOT EXISTS engine_size_cc INTEGER,
ADD COLUMN IF NOT EXISTS riding_experience_years INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS experience_level TEXT DEFAULT 'FUTURE RIDER';

-- Create activity timeline table
CREATE TABLE public.user_activity_timeline (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  activity_type TEXT NOT NULL,
  title TEXT NOT NULL,
  title_ar TEXT,
  description TEXT,
  description_ar TEXT,
  entity_id TEXT,
  entity_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for fast retrieval
CREATE INDEX idx_user_activity_timeline_user_id ON public.user_activity_timeline(user_id);
CREATE INDEX idx_user_activity_timeline_created_at ON public.user_activity_timeline(created_at DESC);

-- Enable RLS
ALTER TABLE public.user_activity_timeline ENABLE ROW LEVEL SECURITY;

-- RLS policies for activity timeline
CREATE POLICY "Users can view their own activity"
ON public.user_activity_timeline
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own activity"
ON public.user_activity_timeline
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admins can view all activity
CREATE POLICY "Admins can view all activity"
ON public.user_activity_timeline
FOR SELECT
USING (is_admin(auth.uid()));

-- Create avatar storage bucket if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for avatars
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own avatar"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own avatar"
ON storage.objects
FOR DELETE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);