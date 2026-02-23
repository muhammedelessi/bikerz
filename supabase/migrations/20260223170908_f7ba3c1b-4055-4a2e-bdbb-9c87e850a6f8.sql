-- Add learning_outcomes column to courses table
ALTER TABLE public.courses
ADD COLUMN learning_outcomes jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.courses.learning_outcomes IS 'Array of {text_en, text_ar} objects for "What You Will Learn" section';
