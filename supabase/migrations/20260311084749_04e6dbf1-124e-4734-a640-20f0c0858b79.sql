
-- Table to track per-user, per-course order statuses for GHL webhook
CREATE TABLE public.user_course_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  course_name TEXT NOT NULL DEFAULT '',
  order_status TEXT NOT NULL DEFAULT 'not purchased',
  status_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_id)
);

ALTER TABLE public.user_course_statuses ENABLE ROW LEVEL SECURITY;

-- Users can read their own statuses
CREATE POLICY "Users can read own course statuses"
  ON public.user_course_statuses FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own statuses
CREATE POLICY "Users can insert own course statuses"
  ON public.user_course_statuses FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own statuses
CREATE POLICY "Users can update own course statuses"
  ON public.user_course_statuses FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Service role bypass for webhooks
CREATE POLICY "Service role full access"
  ON public.user_course_statuses FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- DB function to upsert status and return all courses + count
CREATE OR REPLACE FUNCTION public.upsert_course_status(
  p_user_id UUID,
  p_course_id UUID,
  p_course_name TEXT,
  p_order_status TEXT
)
RETURNS TABLE(courses_json TEXT, total_purchased INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Upsert the status
  INSERT INTO user_course_statuses (user_id, course_id, course_name, order_status, status_date, updated_at)
  VALUES (p_user_id, p_course_id, p_course_name, p_order_status, now(), now())
  ON CONFLICT (user_id, course_id)
  DO UPDATE SET
    order_status = p_order_status,
    course_name = COALESCE(NULLIF(p_course_name, ''), user_course_statuses.course_name),
    status_date = now(),
    updated_at = now();

  -- Return all courses for this user as JSON + purchased count
  RETURN QUERY
  SELECT
    (SELECT json_agg(json_build_object(
      'courseName', ucs.course_name,
      'orderStatus', ucs.order_status,
      'date', to_char(ucs.status_date, 'YYYY-MM-DD')
    ))::TEXT FROM user_course_statuses ucs WHERE ucs.user_id = p_user_id),
    (SELECT COUNT(*)::INTEGER FROM user_course_statuses ucs WHERE ucs.user_id = p_user_id AND ucs.order_status = 'purchased');
END;
$$;

-- Function to get courses without upserting (for signup)
CREATE OR REPLACE FUNCTION public.get_user_course_statuses(p_user_id UUID)
RETURNS TABLE(courses_json TEXT, total_purchased INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE((SELECT json_agg(json_build_object(
      'courseName', ucs.course_name,
      'orderStatus', ucs.order_status,
      'date', to_char(ucs.status_date, 'YYYY-MM-DD')
    ))::TEXT FROM user_course_statuses ucs WHERE ucs.user_id = p_user_id), '[]'),
    COALESCE((SELECT COUNT(*)::INTEGER FROM user_course_statuses ucs WHERE ucs.user_id = p_user_id AND ucs.order_status = 'purchased'), 0);
END;
$$;
