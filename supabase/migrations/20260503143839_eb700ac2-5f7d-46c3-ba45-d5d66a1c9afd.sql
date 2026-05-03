CREATE OR REPLACE FUNCTION public.admin_enroll_user(p_user_id uuid, p_course_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  BEGIN
    INSERT INTO public.course_enrollments (user_id, course_id)
    VALUES (p_user_id, p_course_id);
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  RETURN jsonb_build_object('success', true);
END;
$$;