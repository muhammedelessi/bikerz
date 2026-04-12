-- Run this in Supabase Dashboard → SQL → New query → Run
-- Arabic: يضيف عمود availability_settings ويحدّث مخطط PostgREST
-- English: Adds availability_settings and reloads PostgREST schema cache

alter table public.trainers
  add column if not exists availability_settings jsonb not null default '{}'::jsonb;

-- Optional: languages feature (safe if already applied)
alter table public.trainers
  add column if not exists language_levels jsonb not null default '[]'::jsonb;

notify pgrst, 'reload schema';
