-- When a trainer application is approved, the user is promoted from "student" to "instructor".
-- Previously the trigger ADDED the instructor role on top of student. Now it also REMOVES the
-- student role so the user has a single, accurate role: instructor only.
--
-- This replaces the function from 20260427150000_trainer_applications.sql. The trigger itself
-- (`trainer_applications_after_update_approved`) keeps pointing at this same function name.

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

  -- Promote: add instructor role and drop student role (idempotent).
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.user_id, 'instructor'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  DELETE FROM public.user_roles
  WHERE user_id = NEW.user_id
    AND role = 'student'::public.app_role;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trainer_applications_on_approved() IS
  'SECURITY DEFINER: on pending→approved, inserts trainers + instructor role, and removes the student role.';

-- One-time backfill: any existing instructor still flagged as student loses the student role.
DELETE FROM public.user_roles ur
WHERE ur.role = 'student'::public.app_role
  AND EXISTS (
    SELECT 1
    FROM public.user_roles other
    WHERE other.user_id = ur.user_id
      AND other.role = 'instructor'::public.app_role
  );
