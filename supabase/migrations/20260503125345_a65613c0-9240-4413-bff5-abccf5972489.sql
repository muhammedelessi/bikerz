CREATE OR REPLACE FUNCTION public.enroll_self_with_free_coupon(
  p_course_id uuid,
  p_coupon_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_course RECORD;
  v_validation RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id, title INTO v_course FROM courses WHERE id = p_course_id;
  IF v_course IS NULL THEN
    RAISE EXCEPTION 'Course not found';
  END IF;

  -- Validate coupon server-side; must reduce to 0
  SELECT * INTO v_validation
  FROM validate_and_apply_coupon(p_coupon_code, v_user_id, p_course_id, 1)
  LIMIT 1;

  IF v_validation IS NULL OR NOT v_validation.valid THEN
    RAISE EXCEPTION 'Invalid coupon: %', COALESCE(v_validation.error_message, 'unknown');
  END IF;

  IF v_validation.final_amount > 0 THEN
    RAISE EXCEPTION 'Coupon does not cover full price';
  END IF;

  -- Insert enrollment (idempotent on duplicate)
  BEGIN
    INSERT INTO course_enrollments (user_id, course_id)
    VALUES (v_user_id, p_course_id);
  EXCEPTION WHEN unique_violation THEN
    -- already enrolled, ignore
    NULL;
  END;

  -- Increment coupon usage (best-effort)
  PERFORM increment_coupon_usage(
    v_validation.coupon_id,
    v_user_id,
    p_course_id,
    NULL,
    NULL,
    v_validation.discount_amount,
    v_validation.discount_amount,
    0
  );

  RETURN jsonb_build_object('success', true, 'course_id', p_course_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.enroll_self_with_free_coupon(uuid, text) TO authenticated;