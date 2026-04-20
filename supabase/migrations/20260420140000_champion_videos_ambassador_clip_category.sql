-- Ambassador clip taxonomy for filtering / organizing champion videos
alter table public.champion_videos
  add column if not exists ambassador_clip_category text;

alter table public.champion_videos
  drop constraint if exists champion_videos_ambassador_clip_category_check;

alter table public.champion_videos
  add constraint champion_videos_ambassador_clip_category_check
  check (
    ambassador_clip_category is null
    or ambassador_clip_category in (
      'think_what_if_tips',
      'bikerz_behavior_group_ride',
      'bikerz_behavior_maintenance',
      'bikerz_behavior_lifestyle',
      'master_your_bike_recommendations',
      'master_your_bike_specifications'
    )
  );

comment on column public.champion_videos.ambassador_clip_category is
  'Tip series for ambassador clips: think-what-if, behavior subtopics, or master-your-bike subtopics.';

create index if not exists idx_champion_videos_clip_category
  on public.champion_videos (champion_id, ambassador_clip_category);
