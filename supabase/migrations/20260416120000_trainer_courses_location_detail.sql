alter table public.trainer_courses
  add column if not exists location_detail text default '';
