-- Per-trainer booking exceptions (not per weekday row — avoids duplicating across 7 rows)
alter table public.trainers
  add column if not exists availability_blocked_dates date[] not null default '{}'::date[];

alter table public.trainers
  add column if not exists availability_special_hours jsonb not null default '[]'::jsonb;

comment on column public.trainers.availability_blocked_dates is 'Dates when trainer is unavailable regardless of weekly schedule';
comment on column public.trainers.availability_special_hours is 'One-off windows: [{ "date": "YYYY-MM-DD", "start": "HH:MM", "end": "HH:MM" }]';

notify pgrst, 'reload schema';
