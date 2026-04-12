-- Training booking requests (public users). Timestamp after trainings/trainers tables exist.
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

create index if not exists training_bookings_user_id_idx on public.training_bookings(user_id);
create index if not exists training_bookings_training_id_idx on public.training_bookings(training_id);

alter table public.training_bookings enable row level security;

create policy "Users can select own bookings"
  on public.training_bookings
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own bookings"
  on public.training_bookings
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own bookings"
  on public.training_bookings
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own bookings"
  on public.training_bookings
  for delete
  to authenticated
  using (auth.uid() = user_id);

create policy "Admins can view all bookings"
  on public.training_bookings
  for select
  to authenticated
  using (public.is_admin(auth.uid()));
