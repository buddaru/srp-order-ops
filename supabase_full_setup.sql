-- ============================================================
-- CADRO — Full Supabase Setup
-- Run this in Supabase → SQL Editor
-- Safe to run multiple times (uses IF NOT EXISTS throughout)
-- ============================================================


-- ── 1. PRODUCTION ──────────────────────────────────────────
create table if not exists production (
  id          uuid primary key default gen_random_uuid(),
  date        text not null,
  item_name   text not null,
  quantity    text,
  category    text,
  notes       text,
  completed   boolean not null default false,
  created_at  timestamptz default now()
);

alter table production enable row level security;

drop policy if exists "Authenticated users can manage production" on production;
create policy "Authenticated users can manage production"
  on production for all to authenticated using (true) with check (true);


-- ── 2. PRODUCTION NOTES ────────────────────────────────────
create table if not exists production_notes (
  id          uuid primary key default gen_random_uuid(),
  date        text not null unique,
  content     text,
  updated_at  timestamptz default now()
);

alter table production_notes enable row level security;

drop policy if exists "Authenticated users can manage production notes" on production_notes;
create policy "Authenticated users can manage production notes"
  on production_notes for all to authenticated using (true) with check (true);


-- ── 3. PRODUCTION TEMPLATE ─────────────────────────────────
create table if not exists production_template (
  id          uuid primary key default gen_random_uuid(),
  item_name   text not null,
  quantity    text,
  category    text,
  notes       text,
  sort_order  integer not null default 0
);

alter table production_template enable row level security;

drop policy if exists "Authenticated users can manage production template" on production_template;
create policy "Authenticated users can manage production template"
  on production_template for all to authenticated using (true) with check (true);


-- ── 4. WASTE LOG ───────────────────────────────────────────
create table if not exists waste_log (
  id              uuid primary key default gen_random_uuid(),
  item_name       text not null,
  qty             numeric,
  unit            text,
  cost_per_unit   numeric,
  total_cost      numeric,
  type            text,
  reason          text,
  notes           text,
  logged_date     text,
  created_at      timestamptz default now()
);

alter table waste_log enable row level security;

drop policy if exists "Authenticated users can manage waste log" on waste_log;
create policy "Authenticated users can manage waste log"
  on waste_log for all to authenticated using (true) with check (true);


-- ── 5. EMPLOYEES ───────────────────────────────────────────
create table if not exists employees (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  email         text,
  phone         text,
  pay_rate      numeric,
  default_role  text,
  created_at    timestamptz default now()
);

alter table employees enable row level security;

drop policy if exists "Authenticated users can manage employees" on employees;
create policy "Authenticated users can manage employees"
  on employees for all to authenticated using (true) with check (true);


-- ── 6. SHIFTS ──────────────────────────────────────────────
create table if not exists shifts (
  id              uuid primary key default gen_random_uuid(),
  employee_id     uuid references employees(id) on delete set null,
  employee_name   text,
  employee_email  text,
  shift_date      text not null,
  start_time      text,
  end_time        text,
  role            text,
  notes           text,
  created_at      timestamptz default now()
);

alter table shifts enable row level security;

drop policy if exists "Authenticated users can manage shifts" on shifts;
create policy "Authenticated users can manage shifts"
  on shifts for all to authenticated using (true) with check (true);


-- ── 7. RECIPES ─────────────────────────────────────────────
create table if not exists recipes (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  group_name  text,
  yield_qty   text,
  yield_unit  text,
  allergens   jsonb default '[]'::jsonb,
  image_url   text,
  ingredients jsonb default '[]'::jsonb,
  steps       jsonb default '[]'::jsonb,
  updated_at  timestamptz default now(),
  created_at  timestamptz default now()
);

alter table recipes enable row level security;

drop policy if exists "Authenticated users can manage recipes" on recipes;
create policy "Authenticated users can manage recipes"
  on recipes for all to authenticated using (true) with check (true);


-- ── 8. RECIPE GROUPS ───────────────────────────────────────
create table if not exists recipe_groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  cover_image text,
  created_at  timestamptz default now()
);

alter table recipe_groups enable row level security;

drop policy if exists "Authenticated users can manage recipe groups" on recipe_groups;
create policy "Authenticated users can manage recipe groups"
  on recipe_groups for all to authenticated using (true) with check (true);


-- ── 9. RECIPE GROUP MEMBERS ────────────────────────────────
create table if not exists recipe_group_members (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references recipe_groups(id) on delete cascade,
  recipe_id   uuid not null references recipes(id) on delete cascade,
  unique (group_id, recipe_id)
);

alter table recipe_group_members enable row level security;

drop policy if exists "Authenticated users can manage recipe group members" on recipe_group_members;
create policy "Authenticated users can manage recipe group members"
  on recipe_group_members for all to authenticated using (true) with check (true);


-- ── 10. MENU ITEMS ─────────────────────────────────────────
create table if not exists menu_items (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  category    text not null,
  price       integer not null default 0,
  active      boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz default now(),
  unique (name, category)
);

alter table menu_items enable row level security;

drop policy if exists "Authenticated users can read menu items" on menu_items;
create policy "Authenticated users can read menu items"
  on menu_items for select to authenticated using (true);

drop policy if exists "Admins can manage menu items" on menu_items;
create policy "Admins can manage menu items"
  on menu_items for all to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));


-- ── 11. BUSINESS SETTINGS ──────────────────────────────────
create table if not exists business_settings (
  id              integer primary key default 1,
  business_name   text not null default 'Sweet Red Peach',
  city            text not null default 'Carson',
  sms_ready       text not null default '🎉 Your {business} order is READY, {name}! Come pick up anytime — we''ll have it waiting.',
  sms_pickup      text not null default 'Thanks for visiting {business}, {name}! We hope you love every bite. See you next time!',
  updated_at      timestamptz default now(),
  constraint single_row check (id = 1)
);

alter table business_settings enable row level security;

drop policy if exists "Authenticated users can read business settings" on business_settings;
create policy "Authenticated users can read business settings"
  on business_settings for select to authenticated using (true);

drop policy if exists "Admins can update business settings" on business_settings;
create policy "Admins can update business settings"
  on business_settings for all to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- Seed default row
insert into business_settings (id, business_name, city)
values (1, 'Sweet Red Peach', 'Carson')
on conflict (id) do nothing;
