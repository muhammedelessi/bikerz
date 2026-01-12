-- Create chapter_tests table for quizzes at end of chapters
CREATE TABLE public.chapter_tests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  title_ar TEXT,
  description TEXT,
  description_ar TEXT,
  passing_score INTEGER NOT NULL DEFAULT 70,
  time_limit_minutes INTEGER DEFAULT 30,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create test_questions table
CREATE TABLE public.test_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  test_id UUID NOT NULL REFERENCES public.chapter_tests(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  question_ar TEXT,
  question_type TEXT NOT NULL DEFAULT 'multiple_choice',
  options JSONB NOT NULL DEFAULT '[]',
  correct_answer TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 1,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create test_attempts table
CREATE TABLE public.test_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  test_id UUID NOT NULL REFERENCES public.chapter_tests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  answers JSONB NOT NULL DEFAULT '{}',
  score INTEGER,
  passed BOOLEAN,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on all tables
ALTER TABLE public.chapter_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_attempts ENABLE ROW LEVEL SECURITY;

-- RLS policies for chapter_tests
CREATE POLICY "Anyone can view published tests of published chapters"
ON public.chapter_tests FOR SELECT
USING (
  is_published = true AND 
  chapter_id IN (
    SELECT ch.id FROM chapters ch
    JOIN courses c ON ch.course_id = c.id
    WHERE ch.is_published = true AND c.is_published = true
  )
);

CREATE POLICY "Admins can manage all tests"
ON public.chapter_tests FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Mentors can manage tests for their courses"
ON public.chapter_tests FOR ALL
USING (
  chapter_id IN (
    SELECT ch.id FROM chapters ch
    JOIN courses c ON ch.course_id = c.id
    JOIN mentors m ON c.instructor_id = m.id
    WHERE m.user_id = auth.uid()
  )
);

-- RLS policies for test_questions
CREATE POLICY "Anyone can view questions of published tests"
ON public.test_questions FOR SELECT
USING (
  test_id IN (
    SELECT t.id FROM chapter_tests t
    JOIN chapters ch ON t.chapter_id = ch.id
    JOIN courses c ON ch.course_id = c.id
    WHERE t.is_published = true AND ch.is_published = true AND c.is_published = true
  )
);

CREATE POLICY "Admins can manage all questions"
ON public.test_questions FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Mentors can manage questions for their tests"
ON public.test_questions FOR ALL
USING (
  test_id IN (
    SELECT t.id FROM chapter_tests t
    JOIN chapters ch ON t.chapter_id = ch.id
    JOIN courses c ON ch.course_id = c.id
    JOIN mentors m ON c.instructor_id = m.id
    WHERE m.user_id = auth.uid()
  )
);

-- RLS policies for test_attempts
CREATE POLICY "Users can view their own attempts"
ON public.test_attempts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own attempts"
ON public.test_attempts FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own attempts"
ON public.test_attempts FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all attempts"
ON public.test_attempts FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Mentors can view attempts for their courses"
ON public.test_attempts FOR SELECT
USING (
  test_id IN (
    SELECT t.id FROM chapter_tests t
    JOIN chapters ch ON t.chapter_id = ch.id
    JOIN courses c ON ch.course_id = c.id
    JOIN mentors m ON c.instructor_id = m.id
    WHERE m.user_id = auth.uid()
  )
);

-- Add triggers for updated_at
CREATE TRIGGER update_chapter_tests_updated_at
BEFORE UPDATE ON public.chapter_tests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();