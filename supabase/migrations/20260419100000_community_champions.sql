-- Community Champions feature
-- Tables: community_champions, champion_videos, champion_video_likes, champion_video_comments
-- RLS: public read, authenticated self-manage likes/comments, admin full control.

create extension if not exists pgcrypto;

-- =========================================================================
-- community_champions
-- =========================================================================
create table if not exists public.community_champions (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  nickname text,
  bio text,
  photo_url text,
  country text,
  city text,
  instagram_url text,
  youtube_url text,
  tiktok_url text,
  podcast_url text,
  website_url text,
  is_active boolean not null default true,
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_community_champions_active_order
  on public.community_champions (is_active, order_index);

-- =========================================================================
-- champion_videos
-- =========================================================================
create table if not exists public.champion_videos (
  id uuid primary key default gen_random_uuid(),
  champion_id uuid not null references public.community_champions(id) on delete cascade,
  title text not null,
  description text,
  youtube_url text not null,
  video_type text not null default 'video' check (video_type in ('video', 'podcast')),
  thumbnail_url text,
  order_index int not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_champion_videos_champion
  on public.champion_videos (champion_id, order_index);
create index if not exists idx_champion_videos_published
  on public.champion_videos (published, created_at desc);

-- =========================================================================
-- champion_video_likes
-- =========================================================================
create table if not exists public.champion_video_likes (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.champion_videos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (video_id, user_id)
);

create index if not exists idx_champion_video_likes_video
  on public.champion_video_likes (video_id);
create index if not exists idx_champion_video_likes_user
  on public.champion_video_likes (user_id);

-- =========================================================================
-- champion_video_comments
-- =========================================================================
create table if not exists public.champion_video_comments (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.champion_videos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(trim(content)) > 0 and char_length(content) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_champion_video_comments_video_created
  on public.champion_video_comments (video_id, created_at desc);

-- =========================================================================
-- updated_at triggers
-- =========================================================================
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at on public.community_champions;
create trigger set_updated_at
  before update on public.community_champions
  for each row execute function public.tg_set_updated_at();

drop trigger if exists set_updated_at on public.champion_videos;
create trigger set_updated_at
  before update on public.champion_videos
  for each row execute function public.tg_set_updated_at();

drop trigger if exists set_updated_at on public.champion_video_comments;
create trigger set_updated_at
  before update on public.champion_video_comments
  for each row execute function public.tg_set_updated_at();

-- =========================================================================
-- RLS
-- =========================================================================
alter table public.community_champions       enable row level security;
alter table public.champion_videos           enable row level security;
alter table public.champion_video_likes      enable row level security;
alter table public.champion_video_comments   enable row level security;

-- champions: public read of active; admin full control
drop policy if exists "Champions public select active" on public.community_champions;
create policy "Champions public select active"
  on public.community_champions for select
  using (is_active = true);

drop policy if exists "Champions admin read all" on public.community_champions;
create policy "Champions admin read all"
  on public.community_champions for select
  using (public.is_admin(auth.uid()));

drop policy if exists "Champions admin manage" on public.community_champions;
create policy "Champions admin manage"
  on public.community_champions for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- videos: public read of published+active champion; admin full control
drop policy if exists "Champion videos public select" on public.champion_videos;
create policy "Champion videos public select"
  on public.champion_videos for select
  using (
    published = true
    and exists (
      select 1 from public.community_champions c
      where c.id = champion_videos.champion_id and c.is_active = true
    )
  );

drop policy if exists "Champion videos admin read all" on public.champion_videos;
create policy "Champion videos admin read all"
  on public.champion_videos for select
  using (public.is_admin(auth.uid()));

drop policy if exists "Champion videos admin manage" on public.champion_videos;
create policy "Champion videos admin manage"
  on public.champion_videos for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- likes: anyone can read; authenticated can insert/delete own; admin can manage all
drop policy if exists "Likes public select" on public.champion_video_likes;
create policy "Likes public select"
  on public.champion_video_likes for select
  using (true);

drop policy if exists "Likes insert own" on public.champion_video_likes;
create policy "Likes insert own"
  on public.champion_video_likes for insert
  with check (auth.uid() = user_id);

drop policy if exists "Likes delete own" on public.champion_video_likes;
create policy "Likes delete own"
  on public.champion_video_likes for delete
  using (auth.uid() = user_id);

drop policy if exists "Likes admin manage" on public.champion_video_likes;
create policy "Likes admin manage"
  on public.champion_video_likes for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- comments: anyone can read; authenticated can insert own; user can update/delete own; admin can manage all
drop policy if exists "Comments public select" on public.champion_video_comments;
create policy "Comments public select"
  on public.champion_video_comments for select
  using (true);

drop policy if exists "Comments insert own" on public.champion_video_comments;
create policy "Comments insert own"
  on public.champion_video_comments for insert
  with check (auth.uid() = user_id);

drop policy if exists "Comments update own" on public.champion_video_comments;
create policy "Comments update own"
  on public.champion_video_comments for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Comments delete own" on public.champion_video_comments;
create policy "Comments delete own"
  on public.champion_video_comments for delete
  using (auth.uid() = user_id);

drop policy if exists "Comments admin manage" on public.champion_video_comments;
create policy "Comments admin manage"
  on public.champion_video_comments for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));
