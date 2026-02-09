
-- Create tap_charges table to store all Tap payment records
CREATE TABLE public.tap_charges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  course_id UUID REFERENCES public.courses(id),
  charge_id TEXT UNIQUE, -- Tap charge ID (chg_xxx)
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'SAR',
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, succeeded, failed, cancelled
  payment_method TEXT, -- card, apple_pay, mada, etc.
  card_brand TEXT, -- visa, mastercard, mada
  card_last_four TEXT,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  idempotency_key TEXT UNIQUE NOT NULL,
  tap_response JSONB DEFAULT '{}'::jsonb, -- full response (sanitized)
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  webhook_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tap_charges ENABLE ROW LEVEL SECURITY;

-- Users can view their own charges
CREATE POLICY "Users can view their own charges"
ON public.tap_charges FOR SELECT
USING (auth.uid() = user_id);

-- System (via service role in edge functions) handles inserts/updates
-- Users cannot directly insert or modify charges
CREATE POLICY "Admins can manage all charges"
ON public.tap_charges FOR ALL
USING (is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_tap_charges_updated_at
BEFORE UPDATE ON public.tap_charges
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast lookups
CREATE INDEX idx_tap_charges_user_id ON public.tap_charges(user_id);
CREATE INDEX idx_tap_charges_charge_id ON public.tap_charges(charge_id);
CREATE INDEX idx_tap_charges_status ON public.tap_charges(status);
