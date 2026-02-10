
-- =============================================
-- COUPON & AFFILIATE MANAGEMENT SYSTEM
-- =============================================

-- 1. Coupons table
CREATE TABLE public.coupons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL,
  code_normalized TEXT NOT NULL GENERATED ALWAYS AS (UPPER(TRIM(code))) STORED,
  type TEXT NOT NULL DEFAULT 'percentage_discount' CHECK (type IN ('percentage_discount', 'fixed_amount_discount', 'promotion')),
  value NUMERIC NOT NULL DEFAULT 0 CHECK (value >= 0),
  description TEXT,
  description_ar TEXT,
  
  -- Scope
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  is_global BOOLEAN NOT NULL DEFAULT true,
  
  -- Validity
  start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expiry_date TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Usage limits
  max_usage INTEGER NOT NULL DEFAULT 100 CHECK (max_usage > 0),
  used_count INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  max_per_user INTEGER NOT NULL DEFAULT 1 CHECK (max_per_user > 0),
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'expired')),
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  
  -- Affiliate link (nullable)
  affiliate_id UUID,
  
  -- Stackability
  is_stackable BOOLEAN NOT NULL DEFAULT false,
  
  -- Minimum order
  minimum_amount NUMERIC DEFAULT 0,
  
  -- Admin tracking
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique index on normalized code (case-insensitive, excluding deleted)
CREATE UNIQUE INDEX idx_coupons_code_normalized ON public.coupons (code_normalized) WHERE is_deleted = false;

-- Performance indexes
CREATE INDEX idx_coupons_status ON public.coupons (status) WHERE is_deleted = false;
CREATE INDEX idx_coupons_affiliate ON public.coupons (affiliate_id) WHERE affiliate_id IS NOT NULL;
CREATE INDEX idx_coupons_expiry ON public.coupons (expiry_date) WHERE status = 'active' AND is_deleted = false;

-- Enable RLS
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage all coupons"
  ON public.coupons FOR ALL
  USING (is_admin(auth.uid()));

CREATE POLICY "Users can view active non-deleted coupons"
  ON public.coupons FOR SELECT
  USING (status = 'active' AND is_deleted = false AND expiry_date > now() AND start_date <= now());


-- 2. Affiliates table
CREATE TABLE public.affiliates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  name_ar TEXT,
  email TEXT,
  commission_type TEXT NOT NULL DEFAULT 'percentage' CHECK (commission_type IN ('percentage', 'fixed')),
  commission_value NUMERIC NOT NULL DEFAULT 0 CHECK (commission_value >= 0),
  total_conversions INTEGER NOT NULL DEFAULT 0,
  total_revenue_generated NUMERIC NOT NULL DEFAULT 0,
  total_commission_earned NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

CREATE INDEX idx_affiliates_status ON public.affiliates (status);

ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all affiliates"
  ON public.affiliates FOR ALL
  USING (is_admin(auth.uid()));

CREATE POLICY "Affiliates can view their own record"
  ON public.affiliates FOR SELECT
  USING (auth.uid() = user_id);

-- Add FK from coupons to affiliates
ALTER TABLE public.coupons
  ADD CONSTRAINT coupons_affiliate_id_fkey
  FOREIGN KEY (affiliate_id) REFERENCES public.affiliates(id) ON DELETE SET NULL;


-- 3. Coupon usage log (immutable)
CREATE TABLE public.coupon_usage_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coupon_id UUID NOT NULL REFERENCES public.coupons(id),
  user_id UUID NOT NULL,
  course_id UUID REFERENCES public.courses(id),
  order_id TEXT,
  charge_id TEXT,
  discount_amount NUMERIC NOT NULL DEFAULT 0,
  original_amount NUMERIC NOT NULL DEFAULT 0,
  final_amount NUMERIC NOT NULL DEFAULT 0,
  result TEXT NOT NULL CHECK (result IN ('success', 'failed')),
  failure_reason TEXT,
  applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_coupon_usage_user ON public.coupon_usage_logs (user_id, coupon_id);
CREATE INDEX idx_coupon_usage_coupon ON public.coupon_usage_logs (coupon_id) WHERE result = 'success';
CREATE INDEX idx_coupon_usage_time ON public.coupon_usage_logs (applied_at DESC);

ALTER TABLE public.coupon_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all usage logs"
  ON public.coupon_usage_logs FOR ALL
  USING (is_admin(auth.uid()));

CREATE POLICY "Users can view their own usage"
  ON public.coupon_usage_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert (for logging attempts) but NOT update or delete
CREATE POLICY "System can insert usage logs"
  ON public.coupon_usage_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);


-- 4. Rate limiting table for coupon attempts
CREATE TABLE public.coupon_rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_attempt_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_rate_limit_user ON public.coupon_rate_limits (user_id);

ALTER TABLE public.coupon_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own rate limits"
  ON public.coupon_rate_limits FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- 5. Trigger to auto-update updated_at
CREATE TRIGGER update_coupons_updated_at
  BEFORE UPDATE ON public.coupons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_affiliates_updated_at
  BEFORE UPDATE ON public.affiliates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


-- 6. Function to atomically validate and apply coupon
CREATE OR REPLACE FUNCTION public.validate_and_apply_coupon(
  p_code TEXT,
  p_user_id UUID,
  p_course_id UUID DEFAULT NULL,
  p_original_amount NUMERIC DEFAULT 0
)
RETURNS TABLE(
  valid BOOLEAN,
  coupon_id UUID,
  discount_type TEXT,
  discount_value NUMERIC,
  discount_amount NUMERIC,
  final_amount NUMERIC,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  FOR UPDATE;  -- Lock row to prevent race conditions
  
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
    -- Auto-expire
    UPDATE coupons SET status = 'expired' WHERE id = v_coupon.id;
    RETURN QUERY SELECT false, v_coupon.id, NULL::TEXT, NULL::NUMERIC, 0::NUMERIC, p_original_amount, 'This coupon has expired'::TEXT;
    RETURN;
  END IF;
  
  -- Check global usage
  IF v_coupon.used_count >= v_coupon.max_usage THEN
    RETURN QUERY SELECT false, v_coupon.id, NULL::TEXT, NULL::NUMERIC, 0::NUMERIC, p_original_amount, 'This coupon has reached its maximum usage limit'::TEXT;
    RETURN;
  END IF;
  
  -- Check per-user usage
  SELECT COUNT(*) INTO v_user_usage
  FROM coupon_usage_logs
  WHERE coupon_id = v_coupon.id
    AND user_id = p_user_id
    AND result = 'success';
  
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
    IF EXISTS (SELECT 1 FROM affiliates WHERE id = v_coupon.affiliate_id AND user_id = p_user_id) THEN
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
$$;


-- 7. Function to increment coupon usage atomically (called ONLY after successful payment)
CREATE OR REPLACE FUNCTION public.increment_coupon_usage(
  p_coupon_id UUID,
  p_user_id UUID,
  p_course_id UUID,
  p_order_id TEXT,
  p_charge_id TEXT,
  p_discount_amount NUMERIC,
  p_original_amount NUMERIC,
  p_final_amount NUMERIC
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Atomically increment used_count
  UPDATE coupons
  SET used_count = used_count + 1,
      status = CASE WHEN used_count + 1 >= max_usage THEN 'expired' ELSE status END
  WHERE id = p_coupon_id
    AND is_deleted = false
    AND used_count < max_usage;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Log successful usage (immutable)
  INSERT INTO coupon_usage_logs (
    coupon_id, user_id, course_id, order_id, charge_id,
    discount_amount, original_amount, final_amount, result
  ) VALUES (
    p_coupon_id, p_user_id, p_course_id, p_order_id, p_charge_id,
    p_discount_amount, p_original_amount, p_final_amount, 'success'
  );
  
  -- Update affiliate stats if applicable
  UPDATE affiliates a
  SET total_conversions = total_conversions + 1,
      total_revenue_generated = total_revenue_generated + p_final_amount,
      total_commission_earned = total_commission_earned + 
        CASE 
          WHEN a.commission_type = 'percentage' THEN ROUND(p_final_amount * (a.commission_value / 100), 2)
          ELSE a.commission_value
        END
  WHERE a.id = (SELECT affiliate_id FROM coupons WHERE id = p_coupon_id);
  
  RETURN true;
END;
$$;
