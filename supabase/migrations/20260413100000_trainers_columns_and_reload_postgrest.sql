-- Adds trainer columns if missing, then asks PostgREST to reload its schema cache.
-- Use this if plain ALTER ... IF NOT EXISTS "does nothing" in the UI but the app still errors,
-- or if you need NOTIFY so the API sees new columns immediately.

do $body$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'trainers'
  ) then
    raise exception 'public.trainers does not exist on this database. Run base migrations or confirm you are on the correct Supabase project.';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'trainers' and column_name = 'bike_photos'
  ) then
    execute 'alter table public.trainers add column bike_photos text[] default ''{}''::text[]';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'trainers' and column_name = 'album_photos'
  ) then
    execute 'alter table public.trainers add column album_photos text[] default ''{}''::text[]';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'trainers' and column_name = 'bike_entries'
  ) then
    execute 'alter table public.trainers add column bike_entries jsonb default ''[]''::jsonb';
  end if;
end;
$body$;

notify pgrst, 'reload schema';
