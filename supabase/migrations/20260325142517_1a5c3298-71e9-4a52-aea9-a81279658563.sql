
-- Add ip_address column and skipped/rewatched segments to video_watch_sessions
ALTER TABLE public.video_watch_sessions 
  ADD COLUMN IF NOT EXISTS ip_address text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS skipped_segments jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS rewatched_segments jsonb DEFAULT '[]'::jsonb;

-- Create unique constraint for upsert on (user_id, lesson_id, session_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_watch_sessions_user_lesson_session 
  ON public.video_watch_sessions (user_id, lesson_id, session_id);
