-- ============================================================
-- rank_definitions table
-- Stores all rank metadata used by the profile rank system.
-- Mirrors the hard-coded RANK_DEFINITIONS in useUserProfile.ts
-- but allows admin to manage ranks via the AdminRanks page.
-- ============================================================

create table if not exists public.rank_definitions (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  name_ar         text not null,
  description_en  text not null default '',
  description_ar  text not null default '',
  promotion_trigger_en text not null default '',
  promotion_trigger_ar text not null default '',
  icon            text not null default 'Star',
  color           text not null default 'text-primary',
  bg_color        text not null default 'bg-primary/10',
  border_color    text not null default 'border-primary/30',
  sort_order      int  not null default 0,
  is_admin_only   boolean not null default false,
  -- requirements
  req_first_course    boolean not null default false,
  req_has_license     boolean not null default false,
  req_motorcycle_vin  boolean not null default false,
  req_km_logged       int     null,
  req_core_training   boolean not null default false,
  req_courses_sold_min int    null,
  req_courses_sold_max int    null,
  req_programs_sold_min int   null,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  constraint rank_definitions_name_uniq unique (name)
);

-- -------------------------------------------------------
-- RLS
-- -------------------------------------------------------

alter table public.rank_definitions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'rank_definitions'
    and policyname = 'Public read rank_definitions'
  ) then
    create policy "Public read rank_definitions"
      on public.rank_definitions for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'rank_definitions'
    and policyname = 'Admin manage rank_definitions'
  ) then
    create policy "Admin manage rank_definitions"
      on public.rank_definitions for all
      using (public.is_admin(auth.uid()))
      with check (public.is_admin(auth.uid()));
  end if;
end
$$;

-- -------------------------------------------------------
-- Seed 7 (+ FUTURE RIDER = 8) default ranks
-- Idempotent via ON CONFLICT DO NOTHING
-- -------------------------------------------------------

insert into public.rank_definitions (
  name, name_ar, description_en, description_ar,
  promotion_trigger_en, promotion_trigger_ar,
  icon, color, bg_color, border_color,
  sort_order, is_admin_only,
  req_first_course, req_has_license, req_motorcycle_vin,
  req_km_logged, req_core_training,
  req_courses_sold_min, req_courses_sold_max, req_programs_sold_min
) values

('FUTURE RIDER', 'الراكب القادم',
 'Interested in riding; no courses started.',
 'مهتم بالركوب، لم يبدأ أي كورس بعد.',
 'Purchase your first course.',
 'اشترِ أول كورس لك.',
 'Rocket', 'text-slate-400', 'bg-slate-500/10', 'border-slate-500/30',
 0, false, false, false, false, null, false, null, null, null),

('TRAINEE', 'متدرب',
 'Completing core courses, Basic Training, and Mentorship.',
 'يكمل الكورسات الأساسية والتدريب.',
 'Obtain a motorcycle license and provide a motorcycle VIN.',
 'احصل على رخصة دراجة وقدم رقم الهيكل.',
 'Target', 'text-blue-400', 'bg-blue-500/10', 'border-blue-500/30',
 1, false, true, false, false, null, false, null, null, null),

('1500KM BUILDER', 'بطل 1500 كم',
 'Actively logging road hours and riding time.',
 'يسجل ساعات الطريق ووقت الركوب.',
 'Reach a total of 1500 km logged.',
 'سجّل 1500 كم إجمالي.',
 'Zap', 'text-green-400', 'bg-green-500/10', 'border-green-500/30',
 2, false, true, true, true, null, false, null, null, null),

('SAFE RIDER', 'راكب آمن',
 'Fully qualified rider.',
 'راكب مؤهل بالكامل.',
 'Complete all requirements: license, motorcycle, 1500km, core training.',
 'أكمل كل المتطلبات: رخصة، دراجة، 1500كم، التدريب الأساسي.',
 'Shield', 'text-emerald-400', 'bg-emerald-500/10', 'border-emerald-500/30',
 3, false, true, true, true, 1500, true, null, null, null),

('CHAMPION', 'بطل',
 'Community leader who contributes through mentorship and events.',
 'قائد مجتمع يساهم في الإرشاد والفعاليات.',
 'Contribute through mentorship, events, or content creation.',
 'أسهم بالإرشاد أو الفعاليات أو إنشاء المحتوى.',
 'Trophy', 'text-yellow-400', 'bg-yellow-500/10', 'border-yellow-500/30',
 4, true, true, true, true, 1500, true, null, null, null),

('TRAINER', 'مدرب',
 'Professional instructor with verified teaching skills.',
 'مدرب محترف بمهارات تدريبية موثقة.',
 'Mastered all previous ranks and demonstrated instructional skill.',
 'أتقن جميع الرتب السابقة وأثبت مهارته التدريبية.',
 'Award', 'text-orange-400', 'bg-orange-500/10', 'border-orange-500/30',
 5, true, true, true, true, 1500, true, null, null, null),

('MASTER', 'محترف',
 'Content creator who developed and sold original courses.',
 'منشئ محتوى طوّر وباع كورسات أصلية.',
 'Developed and sold 1 to 3 original courses on the platform.',
 'طوّر وباع من 1 إلى 3 كورسات أصلية على المنصة.',
 'Crown', 'text-purple-400', 'bg-purple-500/10', 'border-purple-500/30',
 6, false, false, false, false, null, false, 1, 3, null),

('LEGEND', 'أسطورة',
 'Industry authority who developed 4 or more training programs.',
 'مرجع في المجال طوّر 4 برامج تدريبية أو أكثر.',
 'Developed and sold 4 or more original training programs.',
 'طوّر وباع 4 برامج تدريبية أصلية أو أكثر.',
 'Star', 'text-primary', 'bg-primary/10', 'border-primary/30',
 7, false, false, false, false, null, false, null, null, 4)

on conflict (name) do nothing;
