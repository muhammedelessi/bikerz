-- Ensures trainer_availability exists and PostgREST picks it up.
-- Fixes: "Could not find the table 'public.trainer_availability' in the schema cache"
-- when 20260414120000_trainer_booking_system.sql was never applied or the transaction rolled back.

create table if not exists public.trainer_availability (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references public.trainers(id) on delete cascade,
  day_of_week int not null check (day_of_week >= 0 and day_of_week <= 6),
  start_time time not null,
  end_time time not null,
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  unique (trainer_id, day_of_week)
);

create index if not exists trainer_availability_trainer_id_idx on public.trainer_availability (trainer_id);

alter table public.trainer_availability enable row level security;

drop policy if exists "Admins manage availability" on public.trainer_availability;
create policy "Admins manage availability" on public.trainer_availability
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

drop policy if exists "Anyone can view availability" on public.trainer_availability;
create policy "Anyone can view availability" on public.trainer_availability
  for select using (true);

notify pgrst, 'reload schema';
