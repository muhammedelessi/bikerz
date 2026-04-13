-- Optional link from auth.users to trainers; enables trainer read access to their training_bookings.

alter table public.trainers
  add column if not exists user_id uuid references auth.users (id) on delete set null;

create index if not exists trainers_user_id_idx on public.trainers (user_id) where user_id is not null;

comment on column public.trainers.user_id is 'Auth user linked to this trainer profile (RLS: view assigned bookings).';

drop policy if exists "Trainers view assigned bookings" on public.training_bookings;
drop policy if exists "Trainers view own bookings" on public.training_bookings;

create policy "Trainers view own bookings"
  on public.training_bookings
  for select
  to authenticated
  using (
    trainer_id in (
      select id from public.trainers where user_id = auth.uid()
    )
  );

notify pgrst, 'reload schema';
