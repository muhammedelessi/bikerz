create table if not exists public.guest_video_views (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null,
  course_id uuid references public.courses(id) on delete cascade,
  video_id text not null,
  ip_address text,
  user_agent text,
  started_at timestamptz default now(),
  unique(fingerprint, course_id)
);

create index if not exists idx_guest_video_views_fingerprint_course
  on public.guest_video_views(fingerprint, course_id);

create index if not exists idx_guest_video_views_ip_course_started
  on public.guest_video_views(ip_address, course_id, started_at desc);
