-- Run this BEFORE get_trainer_booked_slots if you see:
--   relation "public.training_bookings" does not exist
-- Prerequisites on the same database: public.trainings, public.trainers,
-- public.trainer_courses, and public.is_admin(uuid) (used by admin policy).

create table if not exists public.training_bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  training_id uuid references public.trainings(id) on delete cascade not null,
  trainer_id uuid references public.trainers(id) on delete cascade not null,
  trainer_course_id uuid references public.trainer_courses(id) on delete cascade,
  full_name text not null,
  phone text not null,
  email text not null,
  notes text,
  preferred_date date,
  status text not null default 'pending',
  created_at timestamptz default now()
);

alter table public.training_bookings add column if not exists booking_date date;
alter table public.training_bookings add column if not exists start_time time;
alter table public.training_bookings add column if not exists end_time time;
alter table public.training_bookings add column if not exists amount numeric not null default 0;
alter table public.training_bookings add column if not exists currency text not null default 'SAR';
alter table public.training_bookings add column if not exists payment_status text not null default 'unpaid';
alter table public.training_bookings add column if not exists payment_id text;

alter table public.training_bookings drop constraint if exists training_bookings_trainer_course_id_fkey;
alter table public.training_bookings
  add constraint training_bookings_trainer_course_id_fkey
  foreign key (trainer_course_id) references public.trainer_courses(id) on delete set null;

create index if not exists training_bookings_user_id_idx on public.training_bookings(user_id);
create index if not exists training_bookings_training_id_idx on public.training_bookings(training_id);
create index if not exists training_bookings_trainer_id_idx2 on public.training_bookings(trainer_id);
create index if not exists training_bookings_booking_date_idx on public.training_bookings(booking_date);
create index if not exists training_bookings_status_idx on public.training_bookings(status);

alter table public.training_bookings enable row level security;

drop policy if exists "Users can select own bookings" on public.training_bookings;
drop policy if exists "Users can insert own bookings" on public.training_bookings;
drop policy if exists "Users can update own bookings" on public.training_bookings;
drop policy if exists "Users can delete own bookings" on public.training_bookings;
drop policy if exists "Admins can view all bookings" on public.training_bookings;
drop policy if exists "Users manage own bookings" on public.training_bookings;
drop policy if exists "Admins manage all bookings" on public.training_bookings;
drop policy if exists "Public read trainer slot occupancy for scheduling" on public.training_bookings;

create policy "Users manage own bookings" on public.training_bookings
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Admins manage all bookings" on public.training_bookings
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy "Public read trainer slot occupancy for scheduling"
  on public.training_bookings
  for select
  to anon, authenticated
  using (
    booking_date is not null
    and start_time is not null
    and status is distinct from 'cancelled'
  );

notify pgrst, 'reload schema';
