-- Create lesson discussions table for student questions
CREATE TABLE public.lesson_discussions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  question TEXT NOT NULL,
  question_ar TEXT,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  admin_reply TEXT,
  admin_reply_ar TEXT,
  replied_by UUID,
  replied_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lesson_discussions ENABLE ROW LEVEL SECURITY;

-- Users can submit their own questions
CREATE POLICY "Users can submit questions"
ON public.lesson_discussions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can view their own questions
CREATE POLICY "Users can view their own questions"
ON public.lesson_discussions
FOR SELECT
USING (auth.uid() = user_id);

-- Users can view approved questions
CREATE POLICY "Anyone can view approved questions"
ON public.lesson_discussions
FOR SELECT
USING (is_approved = true);

-- Admins can manage all discussions
CREATE POLICY "Admins can manage all discussions"
ON public.lesson_discussions
FOR ALL
USING (is_admin(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_lesson_discussions_updated_at
BEFORE UPDATE ON public.lesson_discussions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_lesson_discussions_lesson_id ON public.lesson_discussions(lesson_id);
CREATE INDEX idx_lesson_discussions_is_approved ON public.lesson_discussions(is_approved);