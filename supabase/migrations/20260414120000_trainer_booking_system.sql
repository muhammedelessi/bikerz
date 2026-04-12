-- Trainer weekly availability (one row per trainer per weekday; JS convention 0=Sun .. 6=Sat)
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

-- Extend training_bookings for scheduled paid bookings
alter table public.training_bookings add column if not exists booking_date date;
alter table public.training_bookings add column if not exists start_time time;
alter table public.training_bookings add column if not exists end_time time;
alter table public.training_bookings add column if not exists amount numeric not null default 0;
alter table public.training_bookings add column if not exists currency text not null default 'SAR';
alter table public.training_bookings add column if not exists payment_status text not null default 'unpaid';
alter table public.training_bookings add column if not exists payment_id text;

-- Relax trainer_course FK for booking retention (if not already)
alter table public.training_bookings drop constraint if exists training_bookings_trainer_course_id_fkey;
alter table public.training_bookings
  add constraint training_bookings_trainer_course_id_fkey
  foreign key (trainer_course_id) references public.trainer_courses(id) on delete set null;

create index if not exists training_bookings_trainer_id_idx2 on public.training_bookings (trainer_id);
create index if not exists training_bookings_booking_date_idx on public.training_bookings (booking_date);
create index if not exists training_bookings_status_idx on public.training_bookings (status);

-- Replace RLS policies for training_bookings
drop policy if exists "Users can select own bookings" on public.training_bookings;
drop policy if exists "Users can insert own bookings" on public.training_bookings;
drop policy if exists "Users can update own bookings" on public.training_bookings;
drop policy if exists "Users can delete own bookings" on public.training_bookings;
drop policy if exists "Admins can view all bookings" on public.training_bookings;
drop policy if exists "Users manage own bookings" on public.training_bookings;
drop policy if exists "Admins manage all bookings" on public.training_bookings;

create policy "Users manage own bookings" on public.training_bookings
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Admins manage all bookings" on public.training_bookings
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

notify pgrst, 'reload schema';
