-- SECURITY FIX 1: Create a secure view for test questions that excludes correct_answer
CREATE VIEW public.test_questions_student AS
SELECT 
  id,
  test_id,
  question,
  question_ar,
  question_type,
  options,
  points,
  position,
  created_at
  -- Explicitly exclude correct_answer
FROM public.test_questions;

-- Grant access to view for authenticated users
GRANT SELECT ON public.test_questions_student TO authenticated;

-- Restrict base table - drop the public policy and make it admin-only
DROP POLICY IF EXISTS "Anyone can view questions of published tests" ON public.test_questions;

CREATE POLICY "Admins can view all questions"
ON public.test_questions
FOR SELECT
USING (is_admin(auth.uid()));

-- SECURITY FIX 2: Server-side grading function to prevent score manipulation
CREATE OR REPLACE FUNCTION public.grade_test_attempt(
  p_test_id UUID,
  p_user_answers JSONB
)
RETURNS TABLE (score INTEGER, passed BOOLEAN, correct_count INTEGER)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_points INTEGER := 0;
  v_correct_points INTEGER := 0;
  v_passing_score INTEGER;
  v_calculated_score INTEGER;
  v_passed BOOLEAN;
  v_user_id UUID;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get passing score from test
  SELECT ct.passing_score INTO v_passing_score
  FROM chapter_tests ct
  WHERE ct.id = p_test_id;
  
  IF v_passing_score IS NULL THEN
    RAISE EXCEPTION 'Test not found';
  END IF;

  -- Calculate score by comparing answers server-side
  SELECT 
    COALESCE(SUM(tq.points), 0)::INTEGER,
    COALESCE(SUM(CASE 
      WHEN p_user_answers->>tq.id::text = tq.correct_answer 
      THEN tq.points ELSE 0 
    END), 0)::INTEGER
  INTO v_total_points, v_correct_points
  FROM test_questions tq
  WHERE tq.test_id = p_test_id;

  -- Calculate percentage score
  v_calculated_score := CASE 
    WHEN v_total_points > 0 
    THEN ROUND((v_correct_points::NUMERIC / v_total_points) * 100)::INTEGER
    ELSE 0 
  END;
  
  v_passed := v_calculated_score >= v_passing_score;

  -- Store attempt with server-calculated results
  INSERT INTO test_attempts (
    test_id, user_id, answers, score, passed, completed_at
  ) VALUES (
    p_test_id, v_user_id, p_user_answers, 
    v_calculated_score, v_passed, NOW()
  );

  RETURN QUERY SELECT v_calculated_score, v_passed, v_correct_points;
END;
$$;

-- SECURITY FIX 3: Restrict profiles table to own user only (was publicly readable)
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = user_id);

-- Allow admins to view all profiles for admin functionality
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (is_admin(auth.uid()));