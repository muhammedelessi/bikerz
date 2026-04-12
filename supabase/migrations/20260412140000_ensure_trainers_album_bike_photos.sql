-- Idempotent: fixes "Could not find the 'album_photos' column of 'trainers' in the schema cache"
-- when older migrations were not applied on the linked Supabase project.
alter table public.trainers add column if not exists bike_photos text[] default '{}'::text[];
alter table public.trainers add column if not exists album_photos text[] default '{}'::text[];
