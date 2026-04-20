-- Knowledge quiz / surveys ("اختبر معلوماتك")
-- Tables: surveys, survey_questions, survey_question_options, survey_answers, survey_completions

create table if not exists public.surveys (
  id uuid primary key default gen_random_uuid(),
  title_ar text not null,
  title_en text not null,
  description_ar text,
  description_en text,
  type text not null check (type in (
    'brands', 'bike_types', 'bike_subtypes', 'bike_models', 'custom'
  )),
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.survey_questions (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  question_type text not null check (question_type in ('yes_no', 'multiple_choice')),
  title_ar text not null,
  title_en text not null,
  image_url text,
  catalog_ref_id uuid,
  catalog_ref_type text check (
    catalog_ref_type is null
    or catalog_ref_type in ('bike_type', 'bike_subtype', 'bike_model', 'brand')
  ),
  sort_order int not null default 0,
  is_active boolean not null default true
);

create index if not exists idx_survey_questions_survey on public.survey_questions (survey_id, sort_order);

create table if not exists public.survey_question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.survey_questions(id) on delete cascade,
  label_ar text not null,
  label_en text not null,
  image_url text,
  is_correct boolean not null default false,
  sort_order int not null default 0
);

create index if not exists idx_survey_question_options_question on public.survey_question_options (question_id, sort_order);

create table if not exists public.survey_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  survey_id uuid not null references public.surveys(id) on delete cascade,
  question_id uuid not null references public.survey_questions(id) on delete cascade,
  answer text not null,
  is_correct boolean,
  answered_at timestamptz not null default now(),
  unique (user_id, question_id)
);

create index if not exists idx_survey_answers_survey_user on public.survey_answers (survey_id, user_id);

create table if not exists public.survey_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  survey_id uuid not null references public.surveys(id) on delete cascade,
  score int not null default 0,
  max_score int not null default 0,
  completed_at timestamptz not null default now(),
  unique (user_id, survey_id)
);

create index if not exists idx_survey_completions_survey on public.survey_completions (survey_id);

-- RLS
alter table public.surveys enable row level security;
alter table public.survey_questions enable row level security;
alter table public.survey_question_options enable row level security;
alter table public.survey_answers enable row level security;
alter table public.survey_completions enable row level security;

create policy "surveys public select"
  on public.surveys for select using (true);

create policy "survey_questions public select"
  on public.survey_questions for select using (true);

create policy "survey_question_options public select"
  on public.survey_question_options for select using (true);

create policy "survey_answers own all"
  on public.survey_answers for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "survey_completions own all"
  on public.survey_completions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "surveys admin manage"
  on public.surveys for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy "survey_questions admin manage"
  on public.survey_questions for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy "survey_question_options admin manage"
  on public.survey_question_options for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy "survey_answers admin select"
  on public.survey_answers for select
  using (public.is_admin(auth.uid()));

create policy "survey_completions admin select"
  on public.survey_completions for select
  using (public.is_admin(auth.uid()));

-- Seed surveys (idempotent by type unique - use insert where not exists)
insert into public.surveys (title_ar, title_en, description_ar, description_en, type, sort_order)
select v.title_ar, v.title_en, v.description_ar, v.description_en, v.type, v.sort_order
from (values
  ('اختبر معرفتك بالعلامات التجارية',
   'Do You Know These Brands?',
   'هل تعرف أشهر ماركات الدراجات النارية؟',
   'Test your knowledge of the top motorcycle brands.',
   'brands', 1),
  ('أي نوع دراجة تفضل؟',
   'Which Motorcycle Type Do You Prefer?',
   'اختر من بين الأنواع للدراجات النارية',
   'Choose from the motorcycle types in the catalog.',
   'bike_types', 2),
  ('أي تصنيف فرعي تفضل؟',
   'Which Subcategory Do You Prefer?',
   'بناءً على إجاباتك السابقة',
   'Based on your previous answers.',
   'bike_subtypes', 3),
  ('أي موديل تفضل؟',
   'Which Model Do You Prefer?',
   'بناءً على إجاباتك السابقة',
   'Based on your previous answers.',
   'bike_models', 4)
) as v(title_ar, title_en, description_ar, description_en, type, sort_order)
where not exists (select 1 from public.surveys s where s.type = v.type);

-- Brands: sample yes/no questions
insert into public.survey_questions (
  survey_id, question_type, title_ar, title_en, sort_order, catalog_ref_type, catalog_ref_id
)
select s.id, 'yes_no', q.title_ar, q.title_en, q.sort_order, 'brand', null
from public.surveys s
cross join (values
  (1, 'هل Honda علامة يابانية للدراجات؟', 'Is Honda a Japanese motorcycle brand?'),
  (2, 'هل Yamaha تصنع دراجات رياضية؟', 'Does Yamaha make sport bikes?'),
  (3, 'هل BMW معروفة بدراجات السياحة؟', 'Is BMW known for touring motorcycles?'),
  (4, 'هل Ducati إيطالية؟', 'Is Ducati an Italian brand?'),
  (5, 'هل KTM متخصصة في الدراجات الترابية؟', 'Is KTM focused on off-road bikes?')
) as q(sort_order, title_ar, title_en)
where s.type = 'brands'
  and not exists (
    select 1 from public.survey_questions sq where sq.survey_id = s.id and sq.sort_order = q.sort_order
  );

-- Bike types: one yes/no per catalog row
insert into public.survey_questions (
  survey_id, question_type, title_ar, title_en, image_url, catalog_ref_id, catalog_ref_type, sort_order
)
select s.id, 'yes_no',
  'هل تفضل دراجات ' || bt.name_ar || '؟',
  'Do you prefer ' || bt.name_en || ' motorcycles?',
  null,
  bt.id,
  'bike_type',
  bt.sort_order
from public.surveys s
cross join public.bike_types bt
where s.type = 'bike_types'
  and not exists (
    select 1 from public.survey_questions sq
    where sq.survey_id = s.id and sq.catalog_ref_id = bt.id and sq.catalog_ref_type = 'bike_type'
  );

-- Bike subtypes: one yes/no per subtype
insert into public.survey_questions (
  survey_id, question_type, title_ar, title_en, image_url, catalog_ref_id, catalog_ref_type, sort_order
)
select s.id, 'yes_no',
  'هل تفضل ' || bs.name_ar || '؟',
  'Do you prefer ' || bs.name_en || '?',
  null,
  bs.id,
  'bike_subtype',
  bs.sort_order
from public.surveys s
cross join public.bike_subtypes bs
where s.type = 'bike_subtypes'
  and not exists (
    select 1 from public.survey_questions sq
    where sq.survey_id = s.id and sq.catalog_ref_id = bs.id and sq.catalog_ref_type = 'bike_subtype'
  );

-- Bike models: one yes/no per model
insert into public.survey_questions (
  survey_id, question_type, title_ar, title_en, image_url, catalog_ref_id, catalog_ref_type, sort_order
)
select s.id, 'yes_no',
  'هل تفضل ' || bm.brand || ' ' || bm.model_name || '؟',
  'Do you prefer ' || bm.brand || ' ' || bm.model_name || '?',
  null,
  bm.id,
  'bike_model',
  bm.sort_order
from public.surveys s
cross join public.bike_models bm
where s.type = 'bike_models'
  and not exists (
    select 1 from public.survey_questions sq
    where sq.survey_id = s.id and sq.catalog_ref_id = bm.id and sq.catalog_ref_type = 'bike_model'
  );
