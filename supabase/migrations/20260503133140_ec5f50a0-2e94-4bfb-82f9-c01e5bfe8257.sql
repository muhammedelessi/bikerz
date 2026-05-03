CREATE OR REPLACE FUNCTION public.enroll_self_with_free_coupon(p_course_id uuid, p_coupon_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_course RECORD;
  v_validation RECORD;
  v_normalized text;
  v_existing_fixed RECORD;
  v_series RECORD;
  v_prefix text;
  v_number int;
  v_match text[];
  v_usage_count int;
  v_discount numeric;
  v_final numeric;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id INTO v_course FROM courses WHERE id = p_course_id;
  IF v_course IS NULL THEN
    RAISE EXCEPTION 'Course not found';
  END IF;

  v_normalized := UPPER(TRIM(p_coupon_code));

  -- 1) Try fixed coupon path
  SELECT id INTO v_existing_fixed FROM coupons
  WHERE is_deleted = false AND code_normalized = v_normalized
  LIMIT 1;

  IF v_existing_fixed.id IS NOT NULL THEN
    SELECT * INTO v_validation
    FROM validate_and_apply_coupon(p_coupon_code, v_user_id, p_course_id, 1)
    LIMIT 1;

    IF v_validation IS NULL OR NOT v_validation.valid THEN
      RAISE EXCEPTION 'Invalid coupon: %', COALESCE(v_validation.error_message, 'unknown');
    END IF;

    IF v_validation.final_amount > 0 THEN
      RAISE EXCEPTION 'Coupon does not cover full price';
    END IF;
  ELSE
    -- 2) Try series coupon path: prefix + number
    v_match := regexp_match(v_normalized, '^([^0-9]+)([0-9]+)$');
    IF v_match IS NULL THEN
      RAISE EXCEPTION 'Invalid coupon: Invalid coupon code';
    END IF;
    v_prefix := upper(v_match[1]);
    v_number := v_match[2]::int;

    SELECT * INTO v_series FROM coupon_series
    WHERE upper(prefix) = v_prefix
      AND range_from <= v_number
      AND range_to >= v_number
      AND status = 'active'
      AND (expiry_date IS NULL OR expiry_date > now())
      AND (is_global = true OR course_id IS NULL OR course_id = p_course_id)
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_series IS NULL THEN
      RAISE EXCEPTION 'Invalid coupon: Invalid coupon code';
    END IF;

    -- Series usage cap (other users only — current user re-attempt allowed)
    SELECT count(*) INTO v_usage_count FROM coupon_series_usage
    WHERE series_id = v_series.id AND code_number = v_number AND user_id <> v_user_id;
    IF v_usage_count >= COALESCE(v_series.max_uses_per_code, 1) THEN
      RAISE EXCEPTION 'Invalid coupon: Code already used';
    END IF;

    -- Compute discount on a nominal amount of 1 (we just need to know if it's 100%)
    IF v_series.discount_type = 'fixed' THEN
      v_discount := LEAST(v_series.discount_value, 1);
    ELSE
      v_discount := round(1 * (LEAST(GREATEST(v_series.discount_value, 0), 100) / 100.0), 2);
    END IF;
    v_final := GREATEST(1 - v_discount, 0);

    IF v_final > 0 THEN
      RAISE EXCEPTION 'Coupon does not cover full price';
    END IF;

    -- Record series usage (idempotent on duplicate)
    BEGIN
      INSERT INTO coupon_series_usage (
        series_id, code_used, code_number, user_id, course_id,
        discount_amount, original_amount, final_amount
      ) VALUES (
        v_series.id, v_normalized, v_number, v_user_id, p_course_id,
        0, 0, 0
      );
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;
  END IF;

  -- Create enrollment (idempotent)
  BEGIN
    INSERT INTO course_enrollments (user_id, course_id)
    VALUES (v_user_id, p_course_id);
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  RETURN jsonb_build_object('success', true, 'course_id', p_course_id);
END;
$function$;