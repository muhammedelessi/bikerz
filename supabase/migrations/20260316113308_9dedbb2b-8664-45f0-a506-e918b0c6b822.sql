
-- Create course_reviews table
CREATE TABLE public.course_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  rating NUMERIC NOT NULL DEFAULT 5,
  comment TEXT,
  is_fake BOOLEAN NOT NULL DEFAULT false,
  fake_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(course_id, user_id)
);

-- Enable RLS
ALTER TABLE public.course_reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can view non-fake reviews (or fake reviews appear as real)
CREATE POLICY "Anyone can view published reviews"
ON public.course_reviews
FOR SELECT
TO public
USING (true);

-- Enrolled users can insert their own real reviews
CREATE POLICY "Enrolled users can insert reviews"
ON public.course_reviews
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND is_fake = false
  AND fake_name IS NULL
  AND EXISTS (
    SELECT 1 FROM public.course_enrollments ce
    WHERE ce.course_id = course_reviews.course_id
    AND ce.user_id = auth.uid()
  )
);

-- Users can update their own real reviews
CREATE POLICY "Users can update own reviews"
ON public.course_reviews
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND is_fake = false);

-- Users can delete their own real reviews
CREATE POLICY "Users can delete own reviews"
ON public.course_reviews
FOR DELETE
TO authenticated
USING (auth.uid() = user_id AND is_fake = false);

-- Admins can manage all reviews (including fake)
CREATE POLICY "Admins can manage all reviews"
ON public.course_reviews
FOR ALL
TO public
USING (public.is_admin(auth.uid()));
