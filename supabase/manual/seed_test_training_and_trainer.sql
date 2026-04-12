-- Run in Supabase Dashboard → SQL (postgres).
-- English: Inserts one practical training "Test Practical Training (seed)" and one trainer
--          "Test Trainer (seed)" with Mon–Fri 09:00–18:00 availability, linked via trainer_courses.
-- العربية: يضيف تدريباً عملياً تجريبياً ومدرباً تجريبياً مع جدول وربط بينهما.
-- Re-run safe: removes previous rows with the same marker names first.

do $$
declare
  v_training_id uuid;
  v_trainer_id uuid;
  v_weekly jsonb := jsonb_build_object(
    'weekly', jsonb_build_array(
      jsonb_build_object('day', 6, 'slots', '[]'::jsonb),
      jsonb_build_object('day', 0, 'slots', '[]'::jsonb),
      jsonb_build_object('day', 1, 'slots', jsonb_build_array(jsonb_build_object('start', '09:00', 'end', '18:00'))),
      jsonb_build_object('day', 2, 'slots', jsonb_build_array(jsonb_build_object('start', '09:00', 'end', '18:00'))),
      jsonb_build_object('day', 3, 'slots', jsonb_build_array(jsonb_build_object('start', '09:00', 'end', '18:00'))),
      jsonb_build_object('day', 4, 'slots', jsonb_build_array(jsonb_build_object('start', '09:00', 'end', '18:00'))),
      jsonb_build_object('day', 5, 'slots', jsonb_build_array(jsonb_build_object('start', '09:00', 'end', '18:00')))
    ),
    'blocked_dates', '[]'::jsonb,
    'special_hours', '[]'::jsonb
  );
begin
  -- Tear down previous seed (trainer first removes FK from trainer_courses to trainer)
  delete from public.trainer_courses tc
  using public.trainers tr
  where tc.trainer_id = tr.id and tr.name_en = 'Test Trainer (seed)';

  delete from public.trainer_availability ta
  using public.trainers tr
  where ta.trainer_id = tr.id and tr.name_en = 'Test Trainer (seed)';

  delete from public.trainers where name_en = 'Test Trainer (seed)';

  delete from public.trainer_courses tc
  using public.trainings t
  where tc.training_id = t.id and t.name_en = 'Test Practical Training (seed)';

  delete from public.trainings where name_en = 'Test Practical Training (seed)';

  insert into public.trainings (
    name_en,
    name_ar,
    type,
    description_en,
    description_ar,
    level,
    status
  ) values (
    'Test Practical Training (seed)',
    'تدريب عملي تجريبي (بذور)',
    'practical',
    'Disposable practical program for QA, booking flow, and payments.',
    'برنامج عملي للاختبار — الحجز والدفع.',
    'beginner',
    'active'
  )
  returning id into v_training_id;

  insert into public.trainers (
    name_en,
    name_ar,
    bio_en,
    bio_ar,
    country,
    city,
    bike_type,
    years_of_experience,
    status,
    motorbike_brand,
    license_type,
    profit_ratio,
    availability_settings,
    availability_blocked_dates,
    availability_special_hours,
    language_levels
  ) values (
    'Test Trainer (seed)',
    'مدرب تجريبي (بذور)',
    'Automated seed trainer for local / staging tests.',
    'مدرب اختبار للبيئات التجريبية.',
    'SA',
    'Riyadh',
    'Sport',
    8,
    'active',
    '',
    'A',
    0,
    v_weekly,
    '{}'::date[],
    '[]'::jsonb,
    '[]'::jsonb
  )
  returning id into v_trainer_id;

  insert into public.trainer_availability (trainer_id, day_of_week, start_time, end_time, is_available)
  values
    (v_trainer_id, 1, time '09:00', time '18:00', true),
    (v_trainer_id, 2, time '09:00', time '18:00', true),
    (v_trainer_id, 3, time '09:00', time '18:00', true),
    (v_trainer_id, 4, time '09:00', time '18:00', true),
    (v_trainer_id, 5, time '09:00', time '18:00', true);

  insert into public.trainer_courses (trainer_id, training_id, price, duration_hours, location, services)
  values (v_trainer_id, v_training_id, 150.00, 2, 'Test venue (seed)', '{}'::text[])
  on conflict (trainer_id, training_id) do update
    set price = excluded.price,
        duration_hours = excluded.duration_hours,
        location = excluded.location;

  raise notice 'Seed training id: % — /trainings/%', v_training_id, v_training_id;
  raise notice 'Seed trainer id: % — /trainers/%', v_trainer_id, v_trainer_id;
end $$;

notify pgrst, 'reload schema';
