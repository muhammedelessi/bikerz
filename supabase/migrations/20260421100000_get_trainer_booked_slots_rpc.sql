-- Public slot occupancy for the booking calendar without relying on RLS for direct
-- SELECT on training_bookings (avoids schedule failures when policies are missing or misordered).
--
-- Prerequisite: public.training_bookings must exist. If you get 42P01 "relation does not exist",
-- run migrations from this repo in order (at minimum 20260411120000_create_training_bookings.sql
-- then 20260414120000_trainer_booking_system.sql), or run:
--   supabase/manual/ensure_training_bookings_table.sql

create or replace function public.get_trainer_booked_slots(
  p_trainer_id uuid,
  p_start_date date,
  p_end_date date
)
returns table (
  booking_date date,
  start_time time,
  status text
)
language sql
stable
security definer
set search_path = public
as $$
  select tb.booking_date, tb.start_time, tb.status
  from public.training_bookings tb
  where tb.trainer_id = p_trainer_id
    and tb.booking_date is not null
    and tb.start_time is not null
    and tb.booking_date >= p_start_date
    and tb.booking_date <= p_end_date
    and tb.status is distinct from 'cancelled';
$$;

revoke all on function public.get_trainer_booked_slots(uuid, date, date) from public;
grant execute on function public.get_trainer_booked_slots(uuid, date, date) to anon, authenticated;

notify pgrst, 'reload schema';
