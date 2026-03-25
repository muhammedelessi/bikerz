-- Migration to extend video watch sessions with IP and custom session ID
ALTER TABLE public.video_watch_sessions ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE public.video_watch_sessions ADD COLUMN IF NOT EXISTS watch_session_id TEXT;
ALTER TABLE public.video_watch_sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Create a unique constraint for the session tracking (user + lesson + session code)
ALTER TABLE public.video_watch_sessions DROP CONSTRAINT IF EXISTS ux_watch_sessions_session;
ALTER TABLE public.video_watch_sessions ADD CONSTRAINT ux_watch_sessions_session UNIQUE(user_id, lesson_id, watch_session_id);

-- Create an index for IP address to speed up fraud searches
CREATE INDEX IF NOT EXISTS idx_watch_sessions_ip ON public.video_watch_sessions(ip_address);
CREATE INDEX IF NOT EXISTS idx_watch_sessions_watch_id ON public.video_watch_sessions(watch_session_id);

