alter table public.trainers add column if not exists bike_photos text[] default '{}';
alter table public.trainers add column if not exists album_photos text[] default '{}';
