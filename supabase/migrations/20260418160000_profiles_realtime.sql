-- Enable realtime on public.profiles so clients receive live updates when
-- an admin (or any other writer) changes a row (e.g. experience_level / rank).
-- Idempotent: only add to the supabase_realtime publication if not already a member.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end
$$;

-- Ensure UPDATE payloads include the full old row so clients can diff fields
-- (e.g. detect experience_level changes). REPLICA IDENTITY FULL makes the
-- `old` record in realtime payloads contain all columns, not just the PK.
alter table public.profiles replica identity full;
