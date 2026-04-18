-- ============================================================
-- Bike Catalog: 3-level hierarchy
--   bike_types → bike_subtypes → bike_models
-- Reference data for admin-managed bike taxonomy.
-- No FK links to profiles/trainers — free-text fields stay untouched.
-- ============================================================

create table if not exists public.bike_types (
  id uuid primary key default gen_random_uuid(),
  name_en text not null,
  name_ar text not null,
  sort_order int default 0,
  created_at timestamptz default now(),
  constraint bike_types_name_en_uniq unique (name_en)
);

create table if not exists public.bike_subtypes (
  id uuid primary key default gen_random_uuid(),
  type_id uuid not null references public.bike_types(id) on delete cascade,
  name_en text not null,
  name_ar text not null,
  sort_order int default 0,
  created_at timestamptz default now(),
  constraint bike_subtypes_type_name_uniq unique (type_id, name_en)
);

create table if not exists public.bike_models (
  id uuid primary key default gen_random_uuid(),
  subtype_id uuid not null references public.bike_subtypes(id) on delete cascade,
  brand text not null,
  model_name text not null,
  sort_order int default 0,
  created_at timestamptz default now(),
  constraint bike_models_unique_triple unique (subtype_id, brand, model_name)
);

create index if not exists idx_bike_subtypes_type on public.bike_subtypes (type_id);
create index if not exists idx_bike_models_subtype on public.bike_models (subtype_id);
create index if not exists idx_bike_models_brand on public.bike_models (brand);
create index if not exists idx_bike_models_model_name on public.bike_models (model_name);

-- ============================================================
-- RLS
-- ============================================================

alter table public.bike_types enable row level security;
alter table public.bike_subtypes enable row level security;
alter table public.bike_models enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='bike_types' and policyname='Public read bike_types') then
    create policy "Public read bike_types" on public.bike_types for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='bike_subtypes' and policyname='Public read bike_subtypes') then
    create policy "Public read bike_subtypes" on public.bike_subtypes for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='bike_models' and policyname='Public read bike_models') then
    create policy "Public read bike_models" on public.bike_models for select using (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='bike_types' and policyname='Admin manage bike_types') then
    create policy "Admin manage bike_types" on public.bike_types for all
      using (public.is_admin(auth.uid()))
      with check (public.is_admin(auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='bike_subtypes' and policyname='Admin manage bike_subtypes') then
    create policy "Admin manage bike_subtypes" on public.bike_subtypes for all
      using (public.is_admin(auth.uid()))
      with check (public.is_admin(auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='bike_models' and policyname='Admin manage bike_models') then
    create policy "Admin manage bike_models" on public.bike_models for all
      using (public.is_admin(auth.uid()))
      with check (public.is_admin(auth.uid()));
  end if;
end
$$;

-- ============================================================
-- Seed data
-- Idempotent: relies on unique constraints + ON CONFLICT DO NOTHING.
-- ============================================================

-- Types --------------------------------------------------------
insert into public.bike_types (name_en, name_ar, sort_order) values
  ('Race',      'سباق',     1),
  ('Touring',   'سياحي',    2),
  ('Cruiser',   'كروزر',    3),
  ('Adventure', 'أدفنشر',   4),
  ('Scrambler', 'سكرامبلر', 5)
on conflict (name_en) do nothing;

-- Subtypes + Models -------------------------------------------
do $$
declare
  v_type_id   uuid;
  v_subtype_id uuid;
begin
  -- =========================
  -- RACE
  -- =========================
  select id into v_type_id from public.bike_types where name_en = 'Race';

  -- Road Racing
  insert into public.bike_subtypes (type_id, name_en, name_ar, sort_order)
  values (v_type_id, 'Road Racing', 'سباق طرق', 1)
  on conflict (type_id, name_en) do nothing;
  select id into v_subtype_id from public.bike_subtypes where type_id = v_type_id and name_en = 'Road Racing';
  insert into public.bike_models (subtype_id, brand, model_name, sort_order) values
    (v_subtype_id, '—', 'SuperBike',    1),
    (v_subtype_id, '—', 'Track Racing', 2)
  on conflict (subtype_id, brand, model_name) do nothing;

  -- Cafe Racer
  insert into public.bike_subtypes (type_id, name_en, name_ar, sort_order)
  values (v_type_id, 'Cafe Racer', 'كافيه ريسر', 2)
  on conflict (type_id, name_en) do nothing;
  select id into v_subtype_id from public.bike_subtypes where type_id = v_type_id and name_en = 'Cafe Racer';
  insert into public.bike_models (subtype_id, brand, model_name, sort_order) values
    (v_subtype_id, 'Harley-Davidson', 'Nightster',  1),
    (v_subtype_id, 'Ducati',          'Nightshift', 2),
    (v_subtype_id, 'BMW',             'R12 S',      3)
  on conflict (subtype_id, brand, model_name) do nothing;

  -- Naked
  insert into public.bike_subtypes (type_id, name_en, name_ar, sort_order)
  values (v_type_id, 'Naked', 'نيكد', 3)
  on conflict (type_id, name_en) do nothing;
  select id into v_subtype_id from public.bike_subtypes where type_id = v_type_id and name_en = 'Naked';
  insert into public.bike_models (subtype_id, brand, model_name, sort_order) values
    (v_subtype_id, '—', 'Standard',      1),
    (v_subtype_id, '—', 'Streetfighter', 2)
  on conflict (subtype_id, brand, model_name) do nothing;

  -- =========================
  -- TOURING
  -- =========================
  select id into v_type_id from public.bike_types where name_en = 'Touring';

  -- Sport Touring
  insert into public.bike_subtypes (type_id, name_en, name_ar, sort_order)
  values (v_type_id, 'Sport Touring', 'سياحي رياضي', 1)
  on conflict (type_id, name_en) do nothing;
  select id into v_subtype_id from public.bike_subtypes where type_id = v_type_id and name_en = 'Sport Touring';
  insert into public.bike_models (subtype_id, brand, model_name, sort_order) values
    (v_subtype_id, 'Kawasaki', 'Ninja 1000 SX', 1),
    (v_subtype_id, 'BMW',      'K 1600 GTL',    2)
  on conflict (subtype_id, brand, model_name) do nothing;

  -- Bagger Touring
  insert into public.bike_subtypes (type_id, name_en, name_ar, sort_order)
  values (v_type_id, 'Bagger Touring', 'باقر سياحي', 2)
  on conflict (type_id, name_en) do nothing;
  select id into v_subtype_id from public.bike_subtypes where type_id = v_type_id and name_en = 'Bagger Touring';
  insert into public.bike_models (subtype_id, brand, model_name, sort_order) values
    (v_subtype_id, 'BMW',             'R18 Bagger',  1),
    (v_subtype_id, 'Harley-Davidson', 'Road Glide',  2),
    (v_subtype_id, 'Indian',          'Chieftain',   3)
  on conflict (subtype_id, brand, model_name) do nothing;

  -- Classic Touring
  insert into public.bike_subtypes (type_id, name_en, name_ar, sort_order)
  values (v_type_id, 'Classic Touring', 'كلاسيكي سياحي', 3)
  on conflict (type_id, name_en) do nothing;
  select id into v_subtype_id from public.bike_subtypes where type_id = v_type_id and name_en = 'Classic Touring';
  insert into public.bike_models (subtype_id, brand, model_name, sort_order) values
    (v_subtype_id, 'Indian',          'Roadmaster',        1),
    (v_subtype_id, 'Harley-Davidson', 'Ultra Limited',     2),
    (v_subtype_id, 'BMW',             'R18 Transcontinental', 3)
  on conflict (subtype_id, brand, model_name) do nothing;

  -- Luxury Touring
  insert into public.bike_subtypes (type_id, name_en, name_ar, sort_order)
  values (v_type_id, 'Luxury Touring', 'سياحي فاخر', 4)
  on conflict (type_id, name_en) do nothing;
  select id into v_subtype_id from public.bike_subtypes where type_id = v_type_id and name_en = 'Luxury Touring';
  insert into public.bike_models (subtype_id, brand, model_name, sort_order) values
    (v_subtype_id, 'BMW',   'K 1600 Grand America', 1),
    (v_subtype_id, 'Honda', 'Goldwing',             2)
  on conflict (subtype_id, brand, model_name) do nothing;

  -- =========================
  -- CRUISER
  -- =========================
  select id into v_type_id from public.bike_types where name_en = 'Cruiser';

  -- Sport Cruiser
  insert into public.bike_subtypes (type_id, name_en, name_ar, sort_order)
  values (v_type_id, 'Sport Cruiser', 'كروزر رياضي', 1)
  on conflict (type_id, name_en) do nothing;
  select id into v_subtype_id from public.bike_subtypes where type_id = v_type_id and name_en = 'Sport Cruiser';
  insert into public.bike_models (subtype_id, brand, model_name, sort_order) values
    (v_subtype_id, 'Harley-Davidson', 'Sportster S', 1),
    (v_subtype_id, 'Indian',          'Sport Chief', 2),
    (v_subtype_id, 'Ducati',          'Diavel',      3)
  on conflict (subtype_id, brand, model_name) do nothing;

  -- Middleweight Cruiser
  insert into public.bike_subtypes (type_id, name_en, name_ar, sort_order)
  values (v_type_id, 'Middleweight Cruiser', 'كروزر متوسط', 2)
  on conflict (type_id, name_en) do nothing;
  select id into v_subtype_id from public.bike_subtypes where type_id = v_type_id and name_en = 'Middleweight Cruiser';
  insert into public.bike_models (subtype_id, brand, model_name, sort_order) values
    (v_subtype_id, 'Kawasaki', 'Vulcan S', 1),
    (v_subtype_id, 'BMW',      'R12',      2),
    (v_subtype_id, 'Indian',   'Scout',    3),
    (v_subtype_id, 'Honda',    'Rebel',    4)
  on conflict (subtype_id, brand, model_name) do nothing;

  -- Classic Cruiser
  insert into public.bike_subtypes (type_id, name_en, name_ar, sort_order)
  values (v_type_id, 'Classic Cruiser', 'كروزر كلاسيكي', 3)
  on conflict (type_id, name_en) do nothing;
  select id into v_subtype_id from public.bike_subtypes where type_id = v_type_id and name_en = 'Classic Cruiser';
  insert into public.bike_models (subtype_id, brand, model_name, sort_order) values
    (v_subtype_id, 'BMW',             'R18',           1),
    (v_subtype_id, 'Harley-Davidson', 'Fatboy 114',    2),
    (v_subtype_id, 'Indian',          'Classic Chief', 3)
  on conflict (subtype_id, brand, model_name) do nothing;

  -- Bagger Cruiser
  insert into public.bike_subtypes (type_id, name_en, name_ar, sort_order)
  values (v_type_id, 'Bagger Cruiser', 'باقر كروزر', 4)
  on conflict (type_id, name_en) do nothing;
  select id into v_subtype_id from public.bike_subtypes where type_id = v_type_id and name_en = 'Bagger Cruiser';
  insert into public.bike_models (subtype_id, brand, model_name, sort_order) values
    (v_subtype_id, 'Harley-Davidson', 'Road King',             1),
    (v_subtype_id, 'Indian',          'Springfield Dark Horse', 2)
  on conflict (subtype_id, brand, model_name) do nothing;

  -- =========================
  -- ADVENTURE
  -- =========================
  select id into v_type_id from public.bike_types where name_en = 'Adventure';

  insert into public.bike_subtypes (type_id, name_en, name_ar, sort_order)
  values (v_type_id, 'Adventure Touring', 'أدفنشر سياحي', 1)
  on conflict (type_id, name_en) do nothing;
  select id into v_subtype_id from public.bike_subtypes where type_id = v_type_id and name_en = 'Adventure Touring';
  insert into public.bike_models (subtype_id, brand, model_name, sort_order) values
    (v_subtype_id, 'Ducati', 'Multistrada V4',      1),
    (v_subtype_id, 'KTM',    'Super Duke GT 1290',  2),
    (v_subtype_id, 'BMW',    'GS 1300',             3)
  on conflict (subtype_id, brand, model_name) do nothing;

  -- =========================
  -- SCRAMBLER
  -- =========================
  select id into v_type_id from public.bike_types where name_en = 'Scrambler';

  insert into public.bike_subtypes (type_id, name_en, name_ar, sort_order)
  values (v_type_id, 'Scrambler', 'سكرامبلر', 1)
  on conflict (type_id, name_en) do nothing;
  select id into v_subtype_id from public.bike_subtypes where type_id = v_type_id and name_en = 'Scrambler';
  insert into public.bike_models (subtype_id, brand, model_name, sort_order) values
    (v_subtype_id, 'CFMOTO', '700 CLC',        1),
    (v_subtype_id, 'Ducati', 'Scrambler Icon', 2),
    (v_subtype_id, 'BMW',    'R12 nine T',     3)
  on conflict (subtype_id, brand, model_name) do nothing;
end
$$;
