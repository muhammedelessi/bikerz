-- Contact fields for trainers (admin add/edit form)
alter table public.trainers
  add column if not exists phone text not null default '';

alter table public.trainers
  add column if not exists email text not null default '';

comment on column public.trainers.phone is 'Trainer contact phone (display / admin)';
comment on column public.trainers.email is 'Trainer contact email (display / admin)';

notify pgrst, 'reload schema';
