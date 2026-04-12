-- Unified weekly slots, blocked dates, and special hours (JSON) per trainer
alter table public.trainers
  add column if not exists availability_settings jsonb not null default '{}'::jsonb;

notify pgrst, 'reload schema';
