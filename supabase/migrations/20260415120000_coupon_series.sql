create table if not exists public.coupon_series (
  id uuid primary key default gen_random_uuid(),
  prefix text not null,
  range_from int not null,
  range_to int not null,
  discount_type text not null default 'percentage',
  discount_value numeric not null,
  max_uses_per_code int not null default 1,
  expiry_date timestamptz,
  course_id uuid references public.courses(id) on delete set null,
  is_global boolean default true,
  status text not null default 'active',
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  description text,
  constraint valid_coupon_series_range check (range_to > range_from),
  constraint valid_coupon_series_value check (discount_value > 0),
  constraint valid_coupon_series_discount_type check (discount_type in ('percentage', 'fixed')),
  constraint valid_coupon_series_status check (status in ('active', 'paused', 'expired'))
);

create table if not exists public.coupon_series_usage (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.coupon_series(id) on delete cascade,
  code_used text not null,
  code_number int not null,
  user_id uuid references auth.users(id),
  course_id uuid references public.courses(id),
  discount_amount numeric not null default 0,
  original_amount numeric not null default 0,
  final_amount numeric not null default 0,
  charge_id text,
  used_at timestamptz default now(),
  unique(series_id, code_number, user_id)
);

create index if not exists idx_coupon_series_lookup
  on public.coupon_series(prefix, range_from, range_to, status);

create index if not exists idx_coupon_series_usage_series_number
  on public.coupon_series_usage(series_id, code_number);

alter table public.coupon_series enable row level security;
alter table public.coupon_series_usage enable row level security;

drop policy if exists "Admins manage coupon series" on public.coupon_series;
create policy "Admins manage coupon series"
  on public.coupon_series
  for all
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));

drop policy if exists "Admins view series usage" on public.coupon_series_usage;
create policy "Admins view series usage"
  on public.coupon_series_usage
  for all
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));

drop policy if exists "Users insert own usage" on public.coupon_series_usage;
create policy "Users insert own usage"
  on public.coupon_series_usage
  for insert
  with check (auth.uid() = user_id);
