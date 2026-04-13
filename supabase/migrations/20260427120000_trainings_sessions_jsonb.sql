-- Session-based curriculum for training programs (admin-defined outline)
alter table public.trainings
  add column if not exists sessions jsonb not null default '[]'::jsonb;

comment on column public.trainings.sessions is 'Ordered curriculum sessions: session_number, titles, duration_hours, points, objectives[{ar,en}]';

notify pgrst, 'reload schema';
