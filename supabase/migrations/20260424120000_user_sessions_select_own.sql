-- useAnalyticsTracking checks existing rows by session_token before insert/update.
-- Previously only admins could SELECT user_sessions, so authenticated users got 403 on GET.

CREATE POLICY "Users can view own session" ON public.user_sessions
FOR SELECT
USING (auth.uid() = user_id);
