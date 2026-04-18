alter table public.trainers
  add column if not exists date_of_birth date default null;
