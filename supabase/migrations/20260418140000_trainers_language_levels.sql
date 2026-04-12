-- Spoken languages with proficiency per trainer (JSON array of { language, level })
alter table public.trainers
  add column if not exists language_levels jsonb not null default '[]'::jsonb;

notify pgrst, 'reload schema';
