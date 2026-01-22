-- Drop and recreate app_role enum with full role hierarchy
DROP TYPE IF EXISTS public.app_role CASCADE;
CREATE TYPE public.app_role AS ENUM ('super_admin', 'academy_admin', 'instructor', 'moderator', 'finance', 'support', 'student');

-- Recreate user_roles table with new enum
DROP TABLE IF EXISTS public.user_roles CASCADE;
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'student',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Super admins can manage all roles" ON public.user_roles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- Recreate has_role function with new enum
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check if user is any admin type
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin', 'academy_admin', 'instructor', 'moderator', 'finance', 'support')
  )
$$;

-- Admin audit logs table
CREATE TABLE public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  old_data jsonb,
  new_data jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view audit logs" ON public.admin_audit_logs
  FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert audit logs" ON public.admin_audit_logs
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()));

-- Admin settings table (global CMS settings)
CREATE TABLE public.admin_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL DEFAULT '{}',
  category text NOT NULL DEFAULT 'general',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read settings" ON public.admin_settings
  FOR SELECT USING (true);

CREATE POLICY "Admins can update settings" ON public.admin_settings
  FOR ALL USING (public.is_admin(auth.uid()));

-- Instructor payout settings
ALTER TABLE public.mentors ADD COLUMN IF NOT EXISTS revenue_share_percentage integer DEFAULT 70;
ALTER TABLE public.mentors ADD COLUMN IF NOT EXISTS payout_status text DEFAULT 'active';

-- Course enhancement for CMS
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft';
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS currency text DEFAULT 'SAR';
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS certificate_enabled boolean DEFAULT true;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS drip_enabled boolean DEFAULT false;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS preview_video_url text;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS seo_title text;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS seo_description text;

-- Lesson enhancements
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS video_provider text DEFAULT 'youtube';
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS video_thumbnail text;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS content_html text;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS content_html_ar text;

-- Manual payment tracking
CREATE TABLE public.manual_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  currency text DEFAULT 'SAR',
  payment_method text NOT NULL,
  reference_number text,
  status text DEFAULT 'pending',
  notes text,
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.manual_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own payments" ON public.manual_payments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all payments" ON public.manual_payments
  FOR ALL USING (public.is_admin(auth.uid()));

-- Insert default admin settings
INSERT INTO public.admin_settings (key, value, category) VALUES
  ('site_name', '{"en": "BIKERZ Academy", "ar": "أكاديمية بايكرز"}', 'branding'),
  ('default_language', '"ar"', 'general'),
  ('vat_rate', '15', 'finance'),
  ('support_email', '"support@bikerz.com"', 'contact'),
  ('enable_certificates', 'true', 'features')
ON CONFLICT (key) DO NOTHING;

-- Update handle_new_user function for new role enum
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create profile for new user
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  
  -- Assign default student role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student');
  
  RETURN NEW;
END;
$$;