-- ============================================================
-- CADRO — SRP Corporate Org + Locations Seed
-- Creates "Sweet Red Peach Corporate" with Inglewood and Menifee
-- locations, and adds javon.nehemiah+corptest@gmail.com as org_owner.
--
-- Pre-flight:
--   1. supabase_multitenant_migration.sql has already been run.
--   2. The +corptest auth user must exist before Step 3.
--      Create it via Supabase Auth dashboard or create-user API first.
-- ============================================================


-- ── STEP 1: Create Corporate organization ───────────────────

insert into organizations (id, name, subscription_status, billing_email, created_at)
values (
  'c3d4e5f6-0003-0003-0003-000000000003',
  'Sweet Red Peach Corporate',
  'active',
  'javon.nehemiah+corptest@gmail.com',
  now()
)
on conflict (id) do nothing;


-- ── STEP 2: Create locations ─────────────────────────────────

insert into locations (id, organization_id, name, slug, timezone, currency, created_at)
values (
  'd4e5f6a7-0004-0004-0004-000000000004',
  'c3d4e5f6-0003-0003-0003-000000000003',
  'Sweet Red Peach Inglewood',
  'srp-inglewood',
  'America/Los_Angeles',
  'usd',
  now()
)
on conflict (id) do nothing;

insert into locations (id, organization_id, name, slug, timezone, currency, created_at)
values (
  'e5f6a7b8-0005-0005-0005-000000000005',
  'c3d4e5f6-0003-0003-0003-000000000003',
  'Sweet Red Peach Menifee',
  'srp-menifee',
  'America/Los_Angeles',
  'usd',
  now()
)
on conflict (id) do nothing;


-- ── STEP 3: Create profiles row ─────────────────────────────
-- The app signs out users who have no profiles row on login.
-- This must be done before the user first tries to log in.

insert into profiles (id, email, full_name, role, created_at)
select
  u.id,
  u.email,
  'Javon Holt',
  'admin',
  now()
from auth.users u
where u.email = 'javon.nehemiah+corptest@gmail.com'
on conflict (id) do nothing;


-- ── STEP 4: Org-owner membership ────────────────────────────

insert into organization_members (user_id, organization_id, role)
select
  u.id,
  'c3d4e5f6-0003-0003-0003-000000000003',
  'org_owner'
from auth.users u
where u.email = 'javon.nehemiah+corptest@gmail.com'
on conflict (user_id, organization_id) do nothing;


-- ── STEP 5: Add unique constraint for per-location Meez sync ─
-- Allows each location to have its own copy of synced recipes.
-- Drop the old single-column unique constraint if it exists first.

alter table recipes drop constraint if exists recipes_meez_id_key;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'recipes_meez_id_location_id_key'
  ) then
    alter table recipes add constraint recipes_meez_id_location_id_key
      unique (meez_id, location_id);
  end if;
end $$;


-- ── STEP 6: Widen menu_items unique constraint to include location ──
-- The old (name, category) constraint prevents the same item existing
-- in multiple locations. Replace it with (name, category, location_id).

alter table menu_items drop constraint if exists menu_items_name_category_key;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'menu_items_name_category_location_id_key'
  ) then
    alter table menu_items add constraint menu_items_name_category_location_id_key
      unique (name, category, location_id);
  end if;
end $$;


-- ── STEP 7: Copy Carson menu items to Inglewood and Menifee ──
-- Copies all menu_items from srp-carson to both new locations.
-- Uses NOT EXISTS so re-running this step is safe.

insert into menu_items (name, category, price, active, sort_order, location_id)
select m.name, m.category, m.price, m.active, m.sort_order,
       'd4e5f6a7-0004-0004-0004-000000000004'
from menu_items m
where m.location_id = 'b2c3d4e5-0002-0002-0002-000000000002'
  and not exists (
    select 1 from menu_items x
    where x.name        = m.name
      and x.category    = m.category
      and x.location_id = 'd4e5f6a7-0004-0004-0004-000000000004'
  );

insert into menu_items (name, category, price, active, sort_order, location_id)
select m.name, m.category, m.price, m.active, m.sort_order,
       'e5f6a7b8-0005-0005-0005-000000000005'
from menu_items m
where m.location_id = 'b2c3d4e5-0002-0002-0002-000000000002'
  and not exists (
    select 1 from menu_items x
    where x.name        = m.name
      and x.category    = m.category
      and x.location_id = 'e5f6a7b8-0005-0005-0005-000000000005'
  );


-- ── STEP 8: Verification ─────────────────────────────────────

select 'org exists',             count(*) from organizations       where id = 'c3d4e5f6-0003-0003-0003-000000000003';
select 'inglewood exists',       count(*) from locations            where id = 'd4e5f6a7-0004-0004-0004-000000000004';
select 'menifee exists',         count(*) from locations            where id = 'e5f6a7b8-0005-0005-0005-000000000005';
select 'profile exists',         count(*) from profiles             where email = 'javon.nehemiah+corptest@gmail.com';
select 'org_owner set',          count(*) from organization_members
  where organization_id = 'c3d4e5f6-0003-0003-0003-000000000003' and role = 'org_owner';
select 'inglewood menu items',   count(*) from menu_items           where location_id = 'd4e5f6a7-0004-0004-0004-000000000004';
select 'menifee menu items',     count(*) from menu_items           where location_id = 'e5f6a7b8-0005-0005-0005-000000000005';
