
-- 1. Remove self-enroll INSERT policy
DROP POLICY IF EXISTS "Users can enroll in courses" ON public.course_enrollments;

-- 2. Restrict admin_settings public read to known-public categories
DROP POLICY IF EXISTS "Anyone can read settings" ON public.admin_settings;
CREATE POLICY "Public can read public settings"
  ON public.admin_settings
  FOR SELECT
  USING (
    category IN ('landing','branding','contact','finance','training','general','features')
  );

-- 3. Trainers can SELECT their own training_bookings
CREATE POLICY "Trainers can view their own bookings"
  ON public.training_bookings
  FOR SELECT
  TO authenticated
  USING (
    trainer_id IN (
      SELECT id FROM public.trainers WHERE user_id = auth.uid()
    )
  );

-- 4. Trainers can SELECT their own training_students
CREATE POLICY "Trainers can view their own students"
  ON public.training_students
  FOR SELECT
  TO authenticated
  USING (
    trainer_id IN (
      SELECT id FROM public.trainers WHERE user_id = auth.uid()
    )
  );
