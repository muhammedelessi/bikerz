-- Log when a logged-in user opens the course checkout (payment) modal — e.g. after "Subscribe now".
create table if not exists public.checkout_payment_page_visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id uuid references public.courses (id) on delete set null,
  source text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_checkout_payment_page_visits_created_at
  on public.checkout_payment_page_visits (created_at desc);

create index if not exists idx_checkout_payment_page_visits_user_created
  on public.checkout_payment_page_visits (user_id, created_at desc);

alter table public.checkout_payment_page_visits enable row level security;

create policy "checkout_visits_insert_own"
  on public.checkout_payment_page_visits for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "checkout_visits_admin_select"
  on public.checkout_payment_page_visits for select
  using (public.is_admin(auth.uid()));
