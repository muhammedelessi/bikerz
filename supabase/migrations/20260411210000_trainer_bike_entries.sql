alter table public.trainers add column if not exists bike_entries jsonb default '[]'::jsonb;
