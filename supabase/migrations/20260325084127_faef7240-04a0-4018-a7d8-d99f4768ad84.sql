
CREATE TABLE public.video_watch_behavior (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  total_watched_seconds integer NOT NULL DEFAULT 0,
  skipped_segments jsonb NOT NULL DEFAULT '[]'::jsonb,
  rewatched_segments jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_position_seconds integer NOT NULL DEFAULT 0,
  video_duration_seconds integer NOT NULL DEFAULT 0,
  completion_percentage numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);

ALTER TABLE public.video_watch_behavior ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can upsert own watch behavior"
  ON public.video_watch_behavior FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all watch behavior"
  ON public.video_watch_behavior FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));
