-- Enrich training_bookings.sessions items with per-session status tracking.
update public.training_bookings tb
set sessions = (
  select jsonb_agg(
    session || jsonb_build_object(
      'status',
      coalesce(session->>'status', 'pending'),
      'completed_at',
      case
        when session ? 'completed_at' then session->'completed_at'
        else 'null'::jsonb
      end
    )
  )
  from jsonb_array_elements(tb.sessions) as session
)
where tb.sessions is not null
  and jsonb_typeof(tb.sessions) = 'array'
  and jsonb_array_length(tb.sessions) > 0;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'training_bookings'
      and policyname = 'Admins can update booking sessions'
  ) then
    create policy "Admins can update booking sessions"
      on public.training_bookings
      for update
      using (is_admin(auth.uid()));
  end if;
end $$;

notify pgrst, 'reload schema';
