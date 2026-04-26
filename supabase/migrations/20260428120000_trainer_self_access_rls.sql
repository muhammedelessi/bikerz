-- Trainer self-service RLS: own trainer row, courses, bookings updates, reviews read, students read,
-- tap_charges linked to trainer courses, optional trainer_availability.
-- Idempotent: safe to re-run.

-- ---------------------------------------------------------------------------
-- 1) Helpers (SECURITY DEFINER) — "desk admin" excludes instructor-only staff
--    so instructors are not treated as full DB admins for column guards.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_academy_desk_admin(p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = p_uid
      AND ur.role = ANY (
        ARRAY[
          'super_admin'::public.app_role,
          'academy_admin'::public.app_role,
          'moderator'::public.app_role,
          'finance'::public.app_role,
          'support'::public.app_role
        ]
      )
  );
$$;

COMMENT ON FUNCTION public.is_academy_desk_admin(uuid) IS 'True for academy desk roles; excludes instructor-only. Used by trainer self-update guards.';

-- ---------------------------------------------------------------------------
-- 2) trainers: SELECT own row (incl. inactive), UPDATE own row + column guard
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "trainers_select_own_user" ON public.trainers;
CREATE POLICY "trainers_select_own_user"
  ON public.trainers
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "trainers_update_own_user" ON public.trainers;
CREATE POLICY "trainers_update_own_user"
  ON public.trainers
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.trainers_guard_admin_only_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF public.is_academy_desk_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Non–desk-admin (including linked instructor): cannot change these columns.
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    NEW.user_id := OLD.user_id;
  END IF;
  IF NEW.profit_ratio IS DISTINCT FROM OLD.profit_ratio THEN
    NEW.profit_ratio := OLD.profit_ratio;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status := OLD.status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trainers_before_update_guard_admin_columns ON public.trainers;
CREATE TRIGGER trainers_before_update_guard_admin_columns
  BEFORE UPDATE ON public.trainers
  FOR EACH ROW
  EXECUTE FUNCTION public.trainers_guard_admin_only_columns();

COMMENT ON FUNCTION public.trainers_guard_admin_only_columns() IS 'SECURITY DEFINER: reverts user_id, profit_ratio, status for non–desk-admin updates.';

-- ---------------------------------------------------------------------------
-- 3) trainer_courses: trainer manages rows for own trainers.id
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "trainer_courses_trainer_manage_own" ON public.trainer_courses;
CREATE POLICY "trainer_courses_trainer_manage_own"
  ON public.trainer_courses
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.trainers t
      WHERE t.id = trainer_courses.trainer_id
        AND t.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.trainers t
      WHERE t.id = trainer_courses.trainer_id
        AND t.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 4) training_students: trainer can read students on own courses
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "training_students_trainer_select_own" ON public.training_students;
CREATE POLICY "training_students_trainer_select_own"
  ON public.training_students
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.trainers t
      WHERE t.id = training_students.trainer_id
        AND t.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 5) trainer_reviews: trainer reads reviews for own profile
-- (Public read already exists; this is redundant if SELECT USING (true) — skip duplicate.)
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 6) training_bookings: trainer UPDATE own rows; trigger locks columns
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "training_bookings_trainer_update_own" ON public.training_bookings;
CREATE POLICY "training_bookings_trainer_update_own"
  ON public.training_bookings
  FOR UPDATE
  TO authenticated
  USING (
    trainer_id IN (SELECT id FROM public.trainers WHERE user_id = auth.uid())
  )
  WITH CHECK (
    trainer_id IN (SELECT id FROM public.trainers WHERE user_id = auth.uid())
  );

CREATE OR REPLACE FUNCTION public.training_bookings_trainer_update_column_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF public.is_academy_desk_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.trainers t
    WHERE t.id = NEW.trainer_id
      AND t.user_id = auth.uid()
  ) THEN
    RETURN NEW;
  END IF;

  -- Assigned trainer: only status + sessions may change; revert everything else from OLD.
  NEW.user_id := OLD.user_id;
  NEW.trainer_id := OLD.trainer_id;
  NEW.training_id := OLD.training_id;
  NEW.trainer_course_id := OLD.trainer_course_id;
  NEW.amount := OLD.amount;
  NEW.currency := OLD.currency;
  NEW.payment_status := OLD.payment_status;
  NEW.payment_id := OLD.payment_id;
  NEW.full_name := OLD.full_name;
  NEW.phone := OLD.phone;
  NEW.email := OLD.email;
  NEW.booking_date := OLD.booking_date;
  NEW.start_time := OLD.start_time;
  NEW.end_time := OLD.end_time;
  NEW.notes := OLD.notes;
  NEW.preferred_date := OLD.preferred_date;
  NEW.created_at := OLD.created_at;
  -- status + sessions left as submitted on NEW
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS training_bookings_before_update_trainer_guard ON public.training_bookings;
CREATE TRIGGER training_bookings_before_update_trainer_guard
  BEFORE UPDATE ON public.training_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.training_bookings_trainer_update_column_guard();

COMMENT ON FUNCTION public.training_bookings_trainer_update_column_guard() IS 'SECURITY DEFINER: for assigned trainer (non desk-admin), only status and sessions may differ from OLD.';

-- ---------------------------------------------------------------------------
-- 7) tap_charges: trainer reads charges linked via metadata.trainer_course_id
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "tap_charges_trainer_select_linked" ON public.tap_charges;
CREATE POLICY "tap_charges_trainer_select_linked"
  ON public.tap_charges
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.trainer_courses tc
      INNER JOIN public.trainers t ON t.id = tc.trainer_id
      WHERE t.user_id = auth.uid()
        AND tc.id::text = (COALESCE(tap_charges.metadata, '{}'::jsonb) ->> 'trainer_course_id')
    )
  );

-- ---------------------------------------------------------------------------
-- 8) trainer_availability: public read + trainer manage own (skip if table missing)
-- ---------------------------------------------------------------------------
DO $tav$
BEGIN
  IF to_regclass('public.trainer_availability') IS NULL THEN
    RETURN;
  END IF;
  EXECUTE 'ALTER TABLE public.trainer_availability ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS "trainer_availability_select_all" ON public.trainer_availability';
  EXECUTE 'CREATE POLICY "trainer_availability_select_all" ON public.trainer_availability FOR SELECT TO authenticated, anon USING (true)';
  EXECUTE 'DROP POLICY IF EXISTS "trainer_availability_trainer_manage_own" ON public.trainer_availability';
  EXECUTE $p$
    CREATE POLICY "trainer_availability_trainer_manage_own"
      ON public.trainer_availability
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.trainers t
          WHERE t.id = trainer_availability.trainer_id
            AND t.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.trainers t
          WHERE t.id = trainer_availability.trainer_id
            AND t.user_id = auth.uid()
        )
      )
  $p$;
END
$tav$;

NOTIFY pgrst, 'reload schema';
