-- Fix the view to use SECURITY INVOKER instead of SECURITY DEFINER
DROP VIEW IF EXISTS public.test_questions_student;

CREATE VIEW public.test_questions_student
WITH (security_invoker = true)
AS
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
FROM public.test_questions;

-- Grant access to view for authenticated users
GRANT SELECT ON public.test_questions_student TO authenticated;

-- Add RLS policy for the view via the base table - allow authenticated users to read questions through the view
-- The view uses SECURITY INVOKER so it respects RLS, need a policy for authenticated users
CREATE POLICY "Authenticated users can view published test questions"
ON public.test_questions
FOR SELECT
TO authenticated
USING (
  test_id IN (
    SELECT t.id FROM chapter_tests t
    JOIN chapters ch ON t.chapter_id = ch.id
    JOIN courses c ON ch.course_id = c.id
    WHERE t.is_published = true 
      AND ch.is_published = true 
      AND c.is_published = true
  )
);