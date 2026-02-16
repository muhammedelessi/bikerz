
CREATE OR REPLACE FUNCTION public.validate_and_apply_coupon(p_code text, p_user_id uuid, p_course_id uuid DEFAULT NULL::uuid, p_original_amount numeric DEFAULT 0)
 RETURNS TABLE(valid boolean, coupon_id uuid, discount_type text, discount_value numeric, discount_amount numeric, final_amount numeric, error_message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_coupon RECORD;
  v_user_usage INTEGER;
  v_discount NUMERIC := 0;
  v_final NUMERIC;
  v_normalized TEXT;
BEGIN
  v_normalized := UPPER(TRIM(p_code));
  
  -- Find coupon
  SELECT * INTO v_coupon
  FROM coupons c
  WHERE c.code_normalized = v_normalized
    AND c.is_deleted = false
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, NULL::NUMERIC, 0::NUMERIC, p_original_amount, 'Invalid coupon code'::TEXT;
    RETURN;
  END IF;
  
  -- Check status
  IF v_coupon.status != 'active' THEN
    RETURN QUERY SELECT false, v_coupon.id, NULL::TEXT, NULL::NUMERIC, 0::NUMERIC, p_original_amount, 'This coupon is no longer active'::TEXT;
    RETURN;
  END IF;
  
  -- Check dates
  IF now() < v_coupon.start_date THEN
    RETURN QUERY SELECT false, v_coupon.id, NULL::TEXT, NULL::NUMERIC, 0::NUMERIC, p_original_amount, 'This coupon is not yet valid'::TEXT;
    RETURN;
  END IF;
  
  IF now() > v_coupon.expiry_date THEN
    UPDATE coupons SET status = 'expired' WHERE id = v_coupon.id;
    RETURN QUERY SELECT false, v_coupon.id, NULL::TEXT, NULL::NUMERIC, 0::NUMERIC, p_original_amount, 'This coupon has expired'::TEXT;
    RETURN;
  END IF;
  
  -- Check global usage
  IF v_coupon.used_count >= v_coupon.max_usage THEN
    RETURN QUERY SELECT false, v_coupon.id, NULL::TEXT, NULL::NUMERIC, 0::NUMERIC, p_original_amount, 'This coupon has reached its maximum usage limit'::TEXT;
    RETURN;
  END IF;
  
  -- Check per-user usage (FIX: use table alias to avoid ambiguous column reference)
  SELECT COUNT(*) INTO v_user_usage
  FROM coupon_usage_logs cul
  WHERE cul.coupon_id = v_coupon.id
    AND cul.user_id = p_user_id
    AND cul.result = 'success';
  
  IF v_user_usage >= v_coupon.max_per_user THEN
    RETURN QUERY SELECT false, v_coupon.id, NULL::TEXT, NULL::NUMERIC, 0::NUMERIC, p_original_amount, 'You have already used this coupon'::TEXT;
    RETURN;
  END IF;
  
  -- Check course scope
  IF v_coupon.course_id IS NOT NULL AND v_coupon.is_global = false THEN
    IF p_course_id IS NULL OR p_course_id != v_coupon.course_id THEN
      RETURN QUERY SELECT false, v_coupon.id, NULL::TEXT, NULL::NUMERIC, 0::NUMERIC, p_original_amount, 'This coupon is not valid for this course'::TEXT;
      RETURN;
    END IF;
  END IF;
  
  -- Check minimum amount
  IF v_coupon.minimum_amount > 0 AND p_original_amount < v_coupon.minimum_amount THEN
    RETURN QUERY SELECT false, v_coupon.id, NULL::TEXT, NULL::NUMERIC, 0::NUMERIC, p_original_amount, 
      ('Minimum purchase amount is ' || v_coupon.minimum_amount::TEXT)::TEXT;
    RETURN;
  END IF;
  
  -- Self-referral check for affiliate coupons
  IF v_coupon.affiliate_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM affiliates a WHERE a.id = v_coupon.affiliate_id AND a.user_id = p_user_id) THEN
      RETURN QUERY SELECT false, v_coupon.id, NULL::TEXT, NULL::NUMERIC, 0::NUMERIC, p_original_amount, 'You cannot use your own affiliate code'::TEXT;
      RETURN;
    END IF;
  END IF;
  
  -- Calculate discount
  IF v_coupon.type = 'percentage_discount' THEN
    v_discount := ROUND(p_original_amount * (v_coupon.value / 100), 2);
  ELSIF v_coupon.type = 'fixed_amount_discount' THEN
    v_discount := LEAST(v_coupon.value, p_original_amount);
  ELSIF v_coupon.type = 'promotion' THEN
    v_discount := v_coupon.value;
  END IF;
  
  v_final := GREATEST(p_original_amount - v_discount, 0);
  
  RETURN QUERY SELECT 
    true,
    v_coupon.id,
    v_coupon.type,
    v_coupon.value,
    v_discount,
    v_final,
    NULL::TEXT;
END;
$function$;
