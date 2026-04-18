alter table public.profiles
  add column if not exists rank_override boolean default false;
