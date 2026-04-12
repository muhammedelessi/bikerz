-- Idempotent: fixes "Could not find the 'availability_settings' column of 'trainers' in the schema cache"
-- when earlier migrations were not applied to the linked project.
alter table public.trainers
  add column if not exists availability_settings jsonb not null default '{}'::jsonb;

alter table public.trainers
  add column if not exists language_levels jsonb not null default '[]'::jsonb;

notify pgrst, 'reload schema';
