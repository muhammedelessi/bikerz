
-- Create courses table
CREATE TABLE public.courses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  title_ar TEXT,
  description TEXT,
  description_ar TEXT,
  thumbnail_url TEXT,
  instructor_id UUID REFERENCES public.mentors(id) ON DELETE SET NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT false,
  difficulty_level TEXT NOT NULL DEFAULT 'beginner' CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
  duration_hours INTEGER DEFAULT 0,
  total_lessons INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create chapters table
CREATE TABLE public.chapters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  title_ar TEXT,
  description TEXT,
  description_ar TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT false,
  is_free BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create lessons table
CREATE TABLE public.lessons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chapter_id UUID NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  title_ar TEXT,
  description TEXT,
  description_ar TEXT,
  video_url TEXT,
  duration_minutes INTEGER DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT false,
  is_free BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create lesson resources table
CREATE TABLE public.lesson_resources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  resource_url TEXT NOT NULL,
  resource_type TEXT NOT NULL DEFAULT 'document' CHECK (resource_type IN ('document', 'video', 'link', 'image')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create course enrollments table
CREATE TABLE public.course_enrollments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  progress_percentage INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, course_id)
);

-- Create lesson progress table
CREATE TABLE public.lesson_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  watch_time_seconds INTEGER DEFAULT 0,
  last_watched_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);

-- Enable RLS on all tables
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;

-- Courses policies
CREATE POLICY "Anyone can view published courses"
  ON public.courses FOR SELECT
  USING (is_published = true);

CREATE POLICY "Admins can manage all courses"
  ON public.courses FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Mentors can manage their own courses"
  ON public.courses FOR ALL
  USING (
    instructor_id IN (
      SELECT id FROM public.mentors WHERE user_id = auth.uid()
    )
  );

-- Chapters policies
CREATE POLICY "Anyone can view published chapters of published courses"
  ON public.chapters FOR SELECT
  USING (
    is_published = true AND
    course_id IN (SELECT id FROM public.courses WHERE is_published = true)
  );

CREATE POLICY "Admins can manage all chapters"
  ON public.chapters FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Mentors can manage chapters of their courses"
  ON public.chapters FOR ALL
  USING (
    course_id IN (
      SELECT c.id FROM public.courses c
      JOIN public.mentors m ON c.instructor_id = m.id
      WHERE m.user_id = auth.uid()
    )
  );

-- Lessons policies
CREATE POLICY "Anyone can view published lessons of published chapters"
  ON public.lessons FOR SELECT
  USING (
    is_published = true AND
    chapter_id IN (
      SELECT ch.id FROM public.chapters ch
      JOIN public.courses c ON ch.course_id = c.id
      WHERE ch.is_published = true AND c.is_published = true
    )
  );

CREATE POLICY "Admins can manage all lessons"
  ON public.lessons FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Mentors can manage lessons of their courses"
  ON public.lessons FOR ALL
  USING (
    chapter_id IN (
      SELECT ch.id FROM public.chapters ch
      JOIN public.courses c ON ch.course_id = c.id
      JOIN public.mentors m ON c.instructor_id = m.id
      WHERE m.user_id = auth.uid()
    )
  );

-- Lesson resources policies
CREATE POLICY "Anyone can view resources of published lessons"
  ON public.lesson_resources FOR SELECT
  USING (
    lesson_id IN (
      SELECT l.id FROM public.lessons l
      JOIN public.chapters ch ON l.chapter_id = ch.id
      JOIN public.courses c ON ch.course_id = c.id
      WHERE l.is_published = true AND ch.is_published = true AND c.is_published = true
    )
  );

CREATE POLICY "Admins can manage all resources"
  ON public.lesson_resources FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Mentors can manage resources of their lessons"
  ON public.lesson_resources FOR ALL
  USING (
    lesson_id IN (
      SELECT l.id FROM public.lessons l
      JOIN public.chapters ch ON l.chapter_id = ch.id
      JOIN public.courses c ON ch.course_id = c.id
      JOIN public.mentors m ON c.instructor_id = m.id
      WHERE m.user_id = auth.uid()
    )
  );

-- Course enrollments policies
CREATE POLICY "Users can view their own enrollments"
  ON public.course_enrollments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can enroll themselves"
  ON public.course_enrollments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all enrollments"
  ON public.course_enrollments FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Mentors can view enrollments for their courses"
  ON public.course_enrollments FOR SELECT
  USING (
    course_id IN (
      SELECT c.id FROM public.courses c
      JOIN public.mentors m ON c.instructor_id = m.id
      WHERE m.user_id = auth.uid()
    )
  );

-- Lesson progress policies
CREATE POLICY "Users can view their own progress"
  ON public.lesson_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own progress"
  ON public.lesson_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can modify their own progress"
  ON public.lesson_progress FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all progress"
  ON public.lesson_progress FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- Create indexes for better performance
CREATE INDEX idx_chapters_course_id ON public.chapters(course_id);
CREATE INDEX idx_chapters_position ON public.chapters(course_id, position);
CREATE INDEX idx_lessons_chapter_id ON public.lessons(chapter_id);
CREATE INDEX idx_lessons_position ON public.lessons(chapter_id, position);
CREATE INDEX idx_lesson_resources_lesson_id ON public.lesson_resources(lesson_id);
CREATE INDEX idx_course_enrollments_user_id ON public.course_enrollments(user_id);
CREATE INDEX idx_course_enrollments_course_id ON public.course_enrollments(course_id);
CREATE INDEX idx_lesson_progress_user_id ON public.lesson_progress(user_id);
CREATE INDEX idx_lesson_progress_lesson_id ON public.lesson_progress(lesson_id);

-- Create triggers for updated_at
CREATE TRIGGER update_courses_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_chapters_updated_at
  BEFORE UPDATE ON public.chapters
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_lessons_updated_at
  BEFORE UPDATE ON public.lessons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
