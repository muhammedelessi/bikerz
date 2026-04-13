-- Custom course bundle tiers and purchases

CREATE TABLE IF NOT EXISTS public.bundle_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  min_courses int NOT NULL UNIQUE,
  discount_percentage numeric NOT NULL DEFAULT 0,
  label_ar text DEFAULT '',
  label_en text DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.course_bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE,
  course_ids uuid[] NOT NULL,
  courses_count int NOT NULL,
  original_price_sar numeric NOT NULL,
  discount_percentage numeric NOT NULL,
  final_price_sar numeric NOT NULL,
  currency text DEFAULT 'SAR',
  payment_id text,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_course_bundles_user_id ON public.course_bundles (user_id);
CREATE INDEX IF NOT EXISTS idx_course_bundles_created_at ON public.course_bundles (created_at DESC);

CREATE TABLE IF NOT EXISTS public.course_bundle_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id uuid REFERENCES public.course_bundles (id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.courses (id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (bundle_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_course_bundle_enrollments_user ON public.course_bundle_enrollments (user_id);

ALTER TABLE public.bundle_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_bundle_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active tiers"
  ON public.bundle_tiers FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins manage tiers"
  ON public.bundle_tiers FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Users select own bundles"
  ON public.course_bundles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all bundles"
  ON public.course_bundles FOR SELECT
  USING (public.is_admin(auth.uid()));

-- Inserts happen via service role (edge functions) only
CREATE POLICY "Admins manage all bundles"
  ON public.course_bundles FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Users select own bundle enrollments"
  ON public.course_bundle_enrollments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all bundle enrollments"
  ON public.course_bundle_enrollments FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins manage bundle enrollments"
  ON public.course_bundle_enrollments FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
