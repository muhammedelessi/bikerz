-- Ensures booking-exception columns exist on trainers and PostgREST reloads.
-- Fixes: "Could not find the 'availability_blocked_dates' column of 'trainers' in the schema cache"
-- when 20260415140000_trainer_availability_exceptions.sql was never applied.

alter table public.trainers
  add column if not exists availability_blocked_dates date[] not null default '{}'::date[];

alter table public.trainers
  add column if not exists availability_special_hours jsonb not null default '[]'::jsonb;

comment on column public.trainers.availability_blocked_dates is 'Dates when trainer is unavailable regardless of weekly schedule';
comment on column public.trainers.availability_special_hours is 'One-off windows: [{ "date": "YYYY-MM-DD", "start": "HH:MM", "end": "HH:MM" }]';

notify pgrst, 'reload schema';
