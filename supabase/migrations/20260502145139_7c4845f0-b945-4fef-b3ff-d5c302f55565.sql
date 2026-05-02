-- 1. Mark captured charge as succeeded
UPDATE public.tap_charges
SET status = 'succeeded', updated_at = now()
WHERE charge_id = 'chg_LV03G4920261718Ju930205851';

-- 2. Mark abandoned charge as failed
UPDATE public.tap_charges
SET status = 'failed', error_message = 'Abandoned by customer (Tap status ABANDONED)', updated_at = now()
WHERE charge_id = 'chg_LV01G5020261717Xe4s0205276';

-- 3. Enroll user in the two bundle courses (idempotent)
INSERT INTO public.course_enrollments (user_id, course_id, enrolled_at, progress_percentage)
SELECT '0ccd7112-0d13-454e-a54f-5ac5b22b2ad0'::uuid, c.id, now(), 0
FROM (VALUES
  ('9e796e06-289a-454e-b1fa-7456dd7b7bde'::uuid),
  ('78fd9a51-f23c-4cca-8c1d-02b6713f2e0e'::uuid)
) AS c(id)
WHERE NOT EXISTS (
  SELECT 1 FROM public.course_enrollments e
  WHERE e.user_id = '0ccd7112-0d13-454e-a54f-5ac5b22b2ad0'::uuid AND e.course_id = c.id
);

-- 4. Record purchased status for both courses
SELECT public.upsert_course_status(
  '0ccd7112-0d13-454e-a54f-5ac5b22b2ad0'::uuid,
  '9e796e06-289a-454e-b1fa-7456dd7b7bde'::uuid,
  'Bikerz Behavior Course',
  'purchased'
);
SELECT public.upsert_course_status(
  '0ccd7112-0d13-454e-a54f-5ac5b22b2ad0'::uuid,
  '78fd9a51-f23c-4cca-8c1d-02b6713f2e0e'::uuid,
  'Select Your Bike Wisely Course',
  'purchased'
);