-- Trainer applications: enum, table, RLS, admin notify (non-fatal on failure), approve → trainers + user_roles (atomic).
-- Timestamp 20260427150000 runs after 20260427140000_trainers_user_id_booking_rls.sql (trainers.user_id — do not re-add here).
-- Idempotent: safe to re-run if the table / enum already exist (e.g. partial apply or SQL Editor re-run).

-- ---------------------------------------------------------------------------
-- 1. ENUM
-- ---------------------------------------------------------------------------
DO $etype$
BEGIN
  CREATE TYPE public.trainer_application_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END;
$etype$;

-- ---------------------------------------------------------------------------
-- 2. Table trainer_applications
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trainer_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  status public.trainer_application_status NOT NULL DEFAULT 'pending',
  name_ar text,
  name_en text,
  bio text NOT NULL,
  bio_ar text,
  bio_en text,
  services text[] NOT NULL DEFAULT '{}',
  photo_url text,
  bike_type text,
  years_of_experience integer,
  country text,
  city text,
  date_of_birth date,
  phone text,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.trainer_applications IS 'Public applications to become a trainer; approved rows sync to trainers + instructor role.';

-- ---------------------------------------------------------------------------
-- 3. Indexes
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS trainer_applications_one_pending_per_user
  ON public.trainer_applications (user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS trainer_applications_status_idx
  ON public.trainer_applications (status);

CREATE INDEX IF NOT EXISTS trainer_applications_created_at_desc_idx
  ON public.trainer_applications (created_at DESC);

-- ---------------------------------------------------------------------------
-- 4. updated_at (reuse project helper)
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trainer_applications_set_updated_at ON public.trainer_applications;
CREATE TRIGGER trainer_applications_set_updated_at
  BEFORE UPDATE ON public.trainer_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 5. RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.trainer_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trainer_applications_select_own" ON public.trainer_applications;
-- SELECT: own row
CREATE POLICY "trainer_applications_select_own"
  ON public.trainer_applications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "trainer_applications_select_admin" ON public.trainer_applications;
-- SELECT: admins
CREATE POLICY "trainer_applications_select_admin"
  ON public.trainer_applications
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "trainer_applications_insert_own" ON public.trainer_applications;
-- INSERT: own user only, not already instructor, no blocking rejected (<30d), no duplicate pending (unique index + explicit NOT EXISTS pending)
CREATE POLICY "trainer_applications_insert_own"
  ON public.trainer_applications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND NOT public.has_role(auth.uid(), 'instructor'::public.app_role)
    AND NOT EXISTS (
      SELECT 1
      FROM public.trainer_applications ta
      WHERE ta.user_id = auth.uid()
        AND ta.status = 'pending'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.trainer_applications ta2
      WHERE ta2.user_id = auth.uid()
        AND ta2.status = 'rejected'
        AND (
          ta2.reviewed_at IS NULL
          OR ta2.reviewed_at > (now() - interval '30 days')
        )
    )
  );

DROP POLICY IF EXISTS "trainer_applications_update_admin" ON public.trainer_applications;
-- UPDATE: admins only
CREATE POLICY "trainer_applications_update_admin"
  ON public.trainer_applications
  FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- No DELETE policy → DELETE denied under RLS for authenticated.

-- ---------------------------------------------------------------------------
-- 6. AFTER INSERT — notify admins (super_admin, academy_admin, moderator, support)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trainer_applications_notify_admins()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  BEGIN
    INSERT INTO public.admin_notifications (
      user_id,
      title,
      title_ar,
      message,
      message_ar,
      type,
      entity_type,
      entity_id,
      action_url
    )
    SELECT
      ur.user_id,
      'New Trainer Application',
      'طلب تدريب جديد',
      'A new trainer application has been submitted',
      'تم تقديم طلب جديد للانضمام كمدرب',
      'info',
      'trainer_application',
      NEW.id::text,
      '/admin/trainers?tab=applications'
    FROM public.user_roles ur
    WHERE ur.role IN (
      'super_admin'::public.app_role,
      'academy_admin'::public.app_role,
      'moderator'::public.app_role,
      'support'::public.app_role
    );
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'trainer_applications_notify_admins failed for application %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trainer_applications_after_insert_notify ON public.trainer_applications;
CREATE TRIGGER trainer_applications_after_insert_notify
  AFTER INSERT ON public.trainer_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.trainer_applications_notify_admins();

-- ---------------------------------------------------------------------------
-- 7. AFTER UPDATE — pending → approved: trainers row + instructor role
--    Columns aligned with 20260331130905 + 20260401120800 + 20260402112852
--    + 20260416130000 + 20260426100000 + 20260427140000
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trainer_applications_on_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_full_name text;
  v_avatar text;
  v_email text;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF OLD.status <> 'pending' OR NEW.status <> 'approved' THEN
    RETURN NEW;
  END IF;

  SELECT p.full_name, p.avatar_url
  INTO v_full_name, v_avatar
  FROM public.profiles p
  WHERE p.user_id = NEW.user_id
  LIMIT 1;

  SELECT u.email::text
  INTO v_email
  FROM auth.users u
  WHERE u.id = NEW.user_id
  LIMIT 1;

  IF EXISTS (SELECT 1 FROM public.trainers t WHERE t.user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'trainer_applications_on_approved: trainer row already exists for user %', NEW.user_id;
  END IF;

  INSERT INTO public.trainers (
    user_id,
    name_ar,
    name_en,
    bio_ar,
    bio_en,
    photo_url,
    country,
    city,
    bike_type,
    years_of_experience,
    services,
    phone,
    email,
    date_of_birth,
    status,
    motorbike_brand,
    license_type
  )
  VALUES (
    NEW.user_id,
    COALESCE(NEW.name_ar, v_full_name, ''),
    COALESCE(NEW.name_en, v_full_name, ''),
    COALESCE(NEW.bio_ar, NEW.bio, ''),
    COALESCE(NEW.bio_en, NEW.bio, ''),
    COALESCE(NEW.photo_url, v_avatar),
    COALESCE(NEW.country, ''),
    COALESCE(NEW.city, ''),
    COALESCE(NEW.bike_type, ''),
    COALESCE(NEW.years_of_experience, 0),
    COALESCE(NEW.services, '{}'),
    COALESCE(NEW.phone, ''),
    COALESCE(v_email, ''),
    NEW.date_of_birth,
    'active'::public.trainer_status,
    '',
    ''
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.user_id, 'instructor'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trainer_applications_after_update_approved ON public.trainer_applications;
CREATE TRIGGER trainer_applications_after_update_approved
  AFTER UPDATE ON public.trainer_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.trainer_applications_on_approved();

-- ---------------------------------------------------------------------------
-- Grants (Supabase API)
-- ---------------------------------------------------------------------------
GRANT USAGE ON TYPE public.trainer_application_status TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.trainer_applications TO authenticated, service_role;

COMMENT ON FUNCTION public.trainer_applications_notify_admins() IS 'SECURITY DEFINER: inserts admin_notifications; failures logged as WARNING only.';
COMMENT ON FUNCTION public.trainer_applications_on_approved() IS 'SECURITY DEFINER: on pending→approved, inserts trainers + instructor user_roles.';

NOTIFY pgrst, 'reload schema';
