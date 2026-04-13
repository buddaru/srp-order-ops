-- ============================================================
-- CADRO — New Features Migration
-- Run in Supabase → SQL Editor
-- Safe to re-run (uses IF NOT EXISTS / DO NOTHING)
-- ============================================================

-- ── 1. RECIPE AUDIT LOG ────────────────────────────────────
create table if not exists recipe_audit_log (
  id           uuid primary key default gen_random_uuid(),
  recipe_id    uuid references recipes(id) on delete cascade,
  recipe_name  text,
  user_id      uuid,
  user_email   text,
  changed_at   timestamptz default now()
);

alter table recipe_audit_log enable row level security;

drop policy if exists "Authenticated users can manage recipe audit log" on recipe_audit_log;
create policy "Authenticated users can manage recipe audit log"
  on recipe_audit_log for all to authenticated using (true) with check (true);

-- ── 2. INGREDIENTS LIBRARY ─────────────────────────────────
create table if not exists ingredients (
  id              uuid primary key default gen_random_uuid(),
  name            text not null unique,
  purchase_unit   text not null default 'oz',
  purchase_price  numeric not null default 0,
  yield_pct       numeric not null default 100,
  supplier        text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

alter table ingredients enable row level security;

drop policy if exists "Authenticated users can manage ingredients" on ingredients;
create policy "Authenticated users can manage ingredients"
  on ingredients for all to authenticated using (true) with check (true);

-- ── 3. RECIPE COST CACHE COLUMNS ───────────────────────────
alter table recipes add column if not exists cached_cost      numeric;
alter table recipes add column if not exists cost_per_serving numeric;
alter table recipes add column if not exists servings         integer default 1;
alter table recipes add column if not exists cost_updated_at  timestamptz;

-- ── 4. MENU CATEGORIES ─────────────────────────────────────
create table if not exists menu_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  sort_order  integer default 0,
  created_at  timestamptz default now()
);

alter table menu_categories enable row level security;

drop policy if exists "Authenticated users can manage menu categories" on menu_categories;
create policy "Authenticated users can manage menu categories"
  on menu_categories for all to authenticated using (true) with check (true);

-- ── 5. MENU ITEM VARIANTS ──────────────────────────────────
-- e.g. cupcake flavors, cake sizes
create table if not exists menu_item_variants (
  id            uuid primary key default gen_random_uuid(),
  menu_item_id  uuid references menu_items(id) on delete cascade,
  name          text not null,
  price_delta   numeric default 0,
  sort_order    integer default 0
);

alter table menu_item_variants enable row level security;

drop policy if exists "Authenticated users can manage menu item variants" on menu_item_variants;
create policy "Authenticated users can manage menu item variants"
  on menu_item_variants for all to authenticated using (true) with check (true);

-- ── 6. MENU ITEM ADD-ONS / CUSTOMIZATIONS ──────────────────
-- e.g. glitter, frosting color, writing on cake
create table if not exists menu_item_addons (
  id            uuid primary key default gen_random_uuid(),
  menu_item_id  uuid references menu_items(id) on delete cascade,
  name          text not null,
  price         numeric default 0,
  category      text,
  sort_order    integer default 0
);

alter table menu_item_addons enable row level security;

drop policy if exists "Authenticated users can manage menu item addons" on menu_item_addons;
create policy "Authenticated users can manage menu item addons"
  on menu_item_addons for all to authenticated using (true) with check (true);

-- ── 7. MENU ITEM → RECIPE LINKS (for costing) ──────────────
-- e.g. "Red Velvet Cake (Dressed)" = 1 portion Red Velvet + 2 portions Frosting
create table if not exists menu_item_recipes (
  id            uuid primary key default gen_random_uuid(),
  menu_item_id  uuid references menu_items(id) on delete cascade,
  recipe_id     uuid references recipes(id) on delete cascade,
  portions      numeric default 1,
  sort_order    integer default 0
);

alter table menu_item_recipes enable row level security;

drop policy if exists "Authenticated users can manage menu item recipes" on menu_item_recipes;
create policy "Authenticated users can manage menu item recipes"
  on menu_item_recipes for all to authenticated using (true) with check (true);
