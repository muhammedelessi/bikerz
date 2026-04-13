-- Multi-session practical training: store all session dates/times in JSONB.
-- Legacy rows: sessions = [] or null → use booking_date + start_time + end_time only.

alter table public.training_bookings
  add column if not exists sessions jsonb not null default '[]'::jsonb;

comment on column public.training_bookings.sessions is
  'Array of {session_number, date, start_time, end_time}. Empty = single-session legacy using booking_date/start_time/end_time.';

-- Slot occupancy: expand jsonb sessions OR fall back to first-session columns.
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
  select (elem->>'date')::date as booking_date,
         coalesce((elem->>'start_time')::time, time '00:00') as start_time,
         tb.status
  from public.training_bookings tb
  cross join lateral jsonb_array_elements(
    case
      when tb.sessions is null then '[]'::jsonb
      when jsonb_typeof(tb.sessions) <> 'array' then '[]'::jsonb
      when coalesce(jsonb_array_length(tb.sessions), 0) = 0 then '[]'::jsonb
      else tb.sessions
    end
  ) as elem
  where tb.trainer_id = p_trainer_id
    and tb.status is distinct from 'cancelled'
    and coalesce(jsonb_array_length(tb.sessions), 0) > 0
    and nullif(trim(elem->>'date'), '') is not null
    and (elem->>'date')::date >= p_start_date
    and (elem->>'date')::date <= p_end_date

  union

  select tb.booking_date, tb.start_time, tb.status
  from public.training_bookings tb
  where tb.trainer_id = p_trainer_id
    and tb.status is distinct from 'cancelled'
    and tb.booking_date is not null
    and tb.start_time is not null
    and tb.booking_date >= p_start_date
    and tb.booking_date <= p_end_date
    and (
      tb.sessions is null
      or jsonb_typeof(tb.sessions) <> 'array'
      or coalesce(jsonb_array_length(tb.sessions), 0) = 0
    );
$$;

revoke all on function public.get_trainer_booked_slots(uuid, date, date) from public;
grant execute on function public.get_trainer_booked_slots(uuid, date, date) to anon, authenticated;

notify pgrst, 'reload schema';
