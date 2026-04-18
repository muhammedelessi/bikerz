-- Add ranking fields to profiles table
alter table public.profiles
  add column if not exists km_logged numeric default 0,
  add column if not exists motorcycle_vin text default '',
  add column if not exists has_license boolean default false,
  add column if not exists license_verified boolean default false,
  add column if not exists vin_verified boolean default false,
  add column if not exists courses_sold_count int default 0;
