-- Optional cached duration for champion videos (seconds). Can be filled manually or by client refresh.
alter table public.champion_videos
  add column if not exists duration_seconds integer;

comment on column public.champion_videos.duration_seconds is 'YouTube video length in seconds (optional cache).';
