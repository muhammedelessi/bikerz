-- Idempotent: fixes "Could not find the 'bike_entries' column of 'trainers' in the schema cache"
alter table public.trainers add column if not exists bike_entries jsonb default '[]'::jsonb;
