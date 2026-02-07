-- =====================================================
-- BIKERZ ANALYTICS INFRASTRUCTURE
-- Comprehensive tracking for mission-control analytics
-- =====================================================

-- 1. User Sessions Table - Track every session
CREATE TABLE public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ DEFAULT now(),
  duration_seconds INTEGER,
  device_type TEXT, -- mobile, tablet, desktop
  browser TEXT,
  os TEXT,
  country TEXT,
  city TEXT,
  timezone TEXT,
  screen_width INTEGER,
  screen_height INTEGER,
  is_active BOOLEAN DEFAULT true,
  page_views INTEGER DEFAULT 0
);

-- 2. Video Playback Events - Second-by-second tracking
CREATE TABLE public.video_playback_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  session_id UUID REFERENCES public.user_sessions(id) ON DELETE SET NULL,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- play, pause, seek, ended, buffering, quality_change, speed_change, error
  video_position_seconds NUMERIC(10,2),
  video_duration_seconds NUMERIC(10,2),
  playback_speed NUMERIC(3,2) DEFAULT 1.0,
  quality_level TEXT, -- auto, 360p, 480p, 720p, 1080p
  buffering_duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 3. Video Watch Sessions - Aggregate watch data per video view
CREATE TABLE public.video_watch_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  session_id UUID REFERENCES public.user_sessions(id) ON DELETE SET NULL,
  lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  total_watch_time_seconds INTEGER DEFAULT 0,
  video_duration_seconds INTEGER,
  max_position_reached_seconds INTEGER DEFAULT 0,
  completion_percentage NUMERIC(5,2) DEFAULT 0,
  pause_count INTEGER DEFAULT 0,
  seek_count INTEGER DEFAULT 0,
  rewind_count INTEGER DEFAULT 0,
  speed_changes INTEGER DEFAULT 0,
  buffering_events INTEGER DEFAULT 0,
  total_buffering_time_ms INTEGER DEFAULT 0,
  average_playback_speed NUMERIC(3,2) DEFAULT 1.0,
  completed BOOLEAN DEFAULT false,
  device_type TEXT
);

-- 4. Page View Events
CREATE TABLE public.page_view_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  session_id UUID REFERENCES public.user_sessions(id) ON DELETE SET NULL,
  page_path TEXT NOT NULL,
  page_title TEXT,
  referrer TEXT,
  time_on_page_seconds INTEGER,
  scroll_depth_percentage INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. User Engagement Scores - Calculated daily
CREATE TABLE public.user_engagement_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score_date DATE NOT NULL DEFAULT CURRENT_DATE,
  engagement_score NUMERIC(5,2) DEFAULT 0, -- 0-100
  watch_consistency_score NUMERIC(5,2) DEFAULT 0,
  lesson_completion_score NUMERIC(5,2) DEFAULT 0,
  return_frequency_score NUMERIC(5,2) DEFAULT 0,
  drop_off_recovery_score NUMERIC(5,2) DEFAULT 0,
  speed_stability_score NUMERIC(5,2) DEFAULT 0,
  sessions_count INTEGER DEFAULT 0,
  total_watch_time_minutes INTEGER DEFAULT 0,
  lessons_completed INTEGER DEFAULT 0,
  quizzes_taken INTEGER DEFAULT 0,
  churn_risk_score NUMERIC(5,2) DEFAULT 0, -- 0-100, higher = more likely to churn
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, score_date)
);

-- 6. Funnel Events - Track conversion steps
CREATE TABLE public.funnel_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  session_id UUID REFERENCES public.user_sessions(id) ON DELETE SET NULL,
  funnel_step TEXT NOT NULL, -- visit, signup, first_lesson, second_lesson, trial_to_paid, etc.
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  previous_step TEXT,
  time_from_previous_step_seconds INTEGER,
  device_type TEXT,
  country TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Revenue Analytics - Detailed revenue tracking
CREATE TABLE public.revenue_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  payment_id UUID REFERENCES public.manual_payments(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT DEFAULT 'SAR',
  event_type TEXT NOT NULL, -- purchase, refund, dispute
  cohort_month TEXT, -- YYYY-MM format for cohort analysis
  user_lifetime_day INTEGER, -- days since user signup
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Infrastructure Metrics
CREATE TABLE public.infrastructure_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type TEXT NOT NULL, -- video_start_time, buffering_ratio, error_rate, cdn_latency
  region TEXT,
  value NUMERIC(12,4) NOT NULL,
  percentile TEXT, -- p50, p95, p99
  sample_count INTEGER DEFAULT 1,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Real-time Presence - For concurrent users
CREATE TABLE public.realtime_presence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID,
  current_page TEXT,
  current_lesson_id UUID REFERENCES public.lessons(id) ON DELETE SET NULL,
  is_watching_video BOOLEAN DEFAULT false,
  last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- 10. Daily Aggregates - Pre-computed daily stats
CREATE TABLE public.analytics_daily_aggregates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_date DATE NOT NULL DEFAULT CURRENT_DATE,
  metric_name TEXT NOT NULL,
  metric_value NUMERIC(18,4) NOT NULL,
  breakdown_dimension TEXT, -- course_id, country, device, etc.
  breakdown_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(aggregate_date, metric_name, breakdown_dimension, breakdown_value)
);

-- Create indexes for performance
CREATE INDEX idx_video_events_user ON public.video_playback_events(user_id);
CREATE INDEX idx_video_events_lesson ON public.video_playback_events(lesson_id);
CREATE INDEX idx_video_events_created ON public.video_playback_events(created_at);
CREATE INDEX idx_watch_sessions_user ON public.video_watch_sessions(user_id);
CREATE INDEX idx_watch_sessions_lesson ON public.video_watch_sessions(lesson_id);
CREATE INDEX idx_user_sessions_user ON public.user_sessions(user_id);
CREATE INDEX idx_user_sessions_active ON public.user_sessions(is_active) WHERE is_active = true;
CREATE INDEX idx_page_views_session ON public.page_view_events(session_id);
CREATE INDEX idx_funnel_events_user ON public.funnel_events(user_id);
CREATE INDEX idx_funnel_events_step ON public.funnel_events(funnel_step);
CREATE INDEX idx_engagement_scores_date ON public.user_engagement_scores(score_date);
CREATE INDEX idx_realtime_presence_heartbeat ON public.realtime_presence(last_heartbeat_at);
CREATE INDEX idx_daily_aggregates_date ON public.analytics_daily_aggregates(aggregate_date);

-- Enable RLS on all tables
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_playback_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_watch_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_view_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_engagement_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funnel_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenue_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.infrastructure_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.realtime_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_daily_aggregates ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Users can insert their own data, admins can read all
CREATE POLICY "Users can insert own session" ON public.user_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own session" ON public.user_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all sessions" ON public.user_sessions FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "Users can insert video events" ON public.video_playback_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view video events" ON public.video_playback_events FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "Users can insert watch sessions" ON public.video_watch_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own watch sessions" ON public.video_watch_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view watch sessions" ON public.video_watch_sessions FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "Anyone can insert page views" ON public.page_view_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can view page views" ON public.page_view_events FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "System can manage engagement scores" ON public.user_engagement_scores FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "Users can view own engagement" ON public.user_engagement_scores FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Anyone can insert funnel events" ON public.funnel_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can view funnel events" ON public.funnel_events FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "Admins can manage revenue analytics" ON public.revenue_analytics FOR ALL USING (is_admin(auth.uid()));

CREATE POLICY "System can manage infra metrics" ON public.infrastructure_metrics FOR ALL USING (is_admin(auth.uid()));

CREATE POLICY "Users can manage own presence" ON public.realtime_presence FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Admins can view presence" ON public.realtime_presence FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "Admins can manage daily aggregates" ON public.analytics_daily_aggregates FOR ALL USING (is_admin(auth.uid()));

-- Enable realtime for presence tracking
ALTER PUBLICATION supabase_realtime ADD TABLE public.realtime_presence;