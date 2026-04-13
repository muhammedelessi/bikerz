alter table public.trainings
  add column if not exists trainer_supplies jsonb default '[]'::jsonb;

comment on column public.trainings.trainer_supplies is
  'Trainer-provided equipment list: [{name_ar, name_en}]';

notify pgrst, 'reload schema';
