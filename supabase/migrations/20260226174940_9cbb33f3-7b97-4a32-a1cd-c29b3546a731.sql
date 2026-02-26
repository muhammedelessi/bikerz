
-- Fix the security definer view warning by recreating as SECURITY INVOKER
CREATE OR REPLACE VIEW public.lesson_activities_student
WITH (security_invoker = true)
AS
SELECT 
  id, lesson_id, activity_type, title, title_ar,
  (data - 'correct_answers' - 'correctAnswers' - 'solution') as data,
  xp_reward, time_limit_seconds, difficulty_level, position, is_published, created_at, updated_at
FROM public.lesson_activities;
