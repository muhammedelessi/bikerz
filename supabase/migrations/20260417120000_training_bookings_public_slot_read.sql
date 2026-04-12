-- Let visitors and logged-in users see which slot times are already taken for a trainer
-- (only rows with a scheduled date/time; PostgREST still limits columns via ?select=).
-- Without this, SELECT on training_bookings fails for anon (no RLS policy) and the
-- booking dialog showed "Could not load the schedule".

drop policy if exists "Public read trainer slot occupancy for scheduling" on public.training_bookings;

create policy "Public read trainer slot occupancy for scheduling"
  on public.training_bookings
  for select
  to anon, authenticated
  using (
    booking_date is not null
    and start_time is not null
    and status is distinct from 'cancelled'
  );

notify pgrst, 'reload schema';
