-- Run in Supabase Dashboard → SQL (as postgres / service role context).
-- English: Creates a disposable trainer "Test Schedule Trainer (seed)" with Mon–Fri 09:00–18:00
--           in both availability_settings.weekly and trainer_availability, and one trainer_course
--           (1h duration) on the first active training.
-- العربية: يضيف مدرباً تجريبياً مع جدول اثنين–جمعة 09:00–18:00 وربط بدورة تدريب نشطة.

do $$
declare
  v_trainer_id uuid;
  v_training_id uuid;
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
  delete from public.trainers
  where name_en = 'Test Schedule Trainer (seed)';

  select t.id
    into v_training_id
  from public.trainings t
  where t.status = 'active'
  order by t.created_at asc
  limit 1;

  if v_training_id is null then
    raise exception 'No active training in public.trainings. Add one in Admin → Trainings, then re-run this script.';
  end if;

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
    'Test Schedule Trainer (seed)',
    'مدرب تجريبي — الجدول',
    'Automated seed for booking / schedule QA.',
    'بيانات اختبار للحجز والجدول.',
    'PS',
    'Ramallah',
    'Sport',
    5,
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
  values (v_trainer_id, v_training_id, 99.00, 1, 'Seed / test venue', '{}'::text[])
  on conflict (trainer_id, training_id) do nothing;

  raise notice 'Seed trainer id: % — open /trainers/% in the app.', v_trainer_id, v_trainer_id;
end $$;

notify pgrst, 'reload schema';
