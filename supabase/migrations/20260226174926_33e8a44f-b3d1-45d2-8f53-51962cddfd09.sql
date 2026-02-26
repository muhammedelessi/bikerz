
-- 1. Create a student-facing view that strips correct answers from the data JSONB
CREATE OR REPLACE VIEW public.lesson_activities_student AS
SELECT 
  id, lesson_id, activity_type, title, title_ar,
  -- Remove correct_answers, correctAnswers, solution, explanation keys from data
  -- Keep only questions/options structure
  (data - 'correct_answers' - 'correctAnswers' - 'solution') as data,
  xp_reward, time_limit_seconds, difficulty_level, position, is_published, created_at, updated_at
FROM public.lesson_activities;

-- 2. Grant SELECT on the view to authenticated and anon roles
GRANT SELECT ON public.lesson_activities_student TO authenticated;
GRANT SELECT ON public.lesson_activities_student TO anon;

-- 3. Create a server-side grading function for lesson activity answers
CREATE OR REPLACE FUNCTION public.grade_lesson_activity(
  p_activity_id UUID,
  p_user_answers TEXT[]
)
RETURNS TABLE (is_correct BOOLEAN, xp_earned INTEGER, attempt_number INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_activity RECORD;
  v_correct_answers TEXT[];
  v_is_correct BOOLEAN;
  v_attempt_num INTEGER;
  v_xp INTEGER;
  v_already_passed BOOLEAN;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Fetch the activity with correct answers (server-side only)
  SELECT * INTO v_activity
  FROM lesson_activities
  WHERE id = p_activity_id
    AND is_published = true
    AND activity_type = 'lesson_quiz';
  
  IF v_activity IS NULL THEN
    RAISE EXCEPTION 'Activity not found';
  END IF;

  -- Extract correct_answers from data JSONB
  SELECT ARRAY(
    SELECT jsonb_array_elements_text(v_activity.data->'correct_answers')
  ) INTO v_correct_answers;

  -- Compare answers (order-independent)
  v_is_correct := (
    array_length(p_user_answers, 1) = array_length(v_correct_answers, 1)
    AND NOT EXISTS (
      SELECT 1 FROM unnest(p_user_answers) AS ua
      WHERE ua NOT IN (SELECT unnest(v_correct_answers))
    )
    AND NOT EXISTS (
      SELECT 1 FROM unnest(v_correct_answers) AS ca
      WHERE ca NOT IN (SELECT unnest(p_user_answers))
    )
  );

  -- Check if already passed
  SELECT EXISTS (
    SELECT 1 FROM user_activity_attempts uaa
    WHERE uaa.user_id = v_user_id
      AND uaa.activity_id = p_activity_id
      AND uaa.passed = true
  ) INTO v_already_passed;

  -- Get next attempt number
  SELECT COALESCE(MAX(uaa.attempt_number), 0) + 1 INTO v_attempt_num
  FROM user_activity_attempts uaa
  WHERE uaa.user_id = v_user_id AND uaa.activity_id = p_activity_id;

  -- Calculate XP (only if correct and not already passed)
  v_xp := CASE WHEN v_is_correct AND NOT v_already_passed THEN v_activity.xp_reward ELSE 0 END;

  -- Record the attempt
  INSERT INTO user_activity_attempts (
    user_id, activity_id, answers, score, max_score, passed, xp_earned, attempt_number
  ) VALUES (
    v_user_id, p_activity_id, 
    jsonb_build_object('selected', to_jsonb(p_user_answers)),
    CASE WHEN v_is_correct THEN 100 ELSE 0 END,
    100, v_is_correct, v_xp, v_attempt_num
  );

  RETURN QUERY SELECT v_is_correct, v_xp, v_attempt_num;
END;
$$;
