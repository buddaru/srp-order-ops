-- ============================================================
-- CADRO — SRP Data Backfill
-- RUN ON STAGING FIRST with a copy of prod data.
-- DO NOT run on prod until staging is verified clean.
--
-- Pre-flight checklist:
--   1. supabase_multitenant_migration.sql has been run.
--   2. You have a point-in-time backup of prod (Supabase dashboard → Backups).
--   3. All counts below return the expected numbers when run on staging.
-- ============================================================


-- ── STEP 1: Create SRP organization ─────────────────────────
-- Fixed UUIDs so this script is idempotent across runs.

insert into organizations (id, name, subscription_status, billing_email, created_at)
values (
  'a1b2c3d4-0001-0001-0001-000000000001',
  'Sweet Red Peach Bakery',
  'active',
  'javon.nehemiah@gmail.com',
  now()
)
on conflict (id) do nothing;


-- ── STEP 2: Create SRP location (Carson) ────────────────────

insert into locations (id, organization_id, name, slug, timezone, currency, created_at)
values (
  'b2c3d4e5-0002-0002-0002-000000000002',
  'a1b2c3d4-0001-0001-0001-000000000001',
  'Sweet Red Peach Carson',
  'srp-carson',
  'America/Los_Angeles',
  'usd',
  now()
)
on conflict (id) do nothing;


-- ── STEP 3: Org-owner membership for Javon ──────────────────
-- Inserts a row for any user whose email matches — safe if email changes or
-- if run multiple times (ON CONFLICT DO NOTHING).

insert into organization_members (user_id, organization_id, role)
select
  u.id,
  'a1b2c3d4-0001-0001-0001-000000000001',
  'org_owner'
from auth.users u
where u.email = 'javon.nehemiah@gmail.com'
on conflict (user_id, organization_id) do nothing;


-- ── STEP 4: Location-member rows for remaining SRP staff ────
-- Maps existing profile roles:
--   profile.role = 'admin'    → location_members.role = 'manager'
--   profile.role = 'employee' → location_members.role = 'employee'
-- Javon (org_owner) is intentionally excluded — org-level cascades cover him.

insert into location_members (user_id, location_id, role)
select
  p.id,
  'b2c3d4e5-0002-0002-0002-000000000002',
  case when p.role = 'admin' then 'manager' else 'employee' end
from profiles p
where p.email != 'javon.nehemiah@gmail.com'
  and p.id not in (
    select user_id from location_members
    where location_id = 'b2c3d4e5-0002-0002-0002-000000000002'
  )
on conflict (user_id, location_id) do nothing;


-- ── STEP 5: Backfill location_id on all existing data ───────
-- Each statement is safe to re-run (WHERE location_id IS NULL guard).

update orders
set location_id = 'b2c3d4e5-0002-0002-0002-000000000002'
where location_id is null;

update production
set location_id = 'b2c3d4e5-0002-0002-0002-000000000002'
where location_id is null;

update production_notes
set location_id = 'b2c3d4e5-0002-0002-0002-000000000002'
where location_id is null;

update production_template
set location_id = 'b2c3d4e5-0002-0002-0002-000000000002'
where location_id is null;

update waste_log
set location_id = 'b2c3d4e5-0002-0002-0002-000000000002'
where location_id is null;

update employees
set location_id = 'b2c3d4e5-0002-0002-0002-000000000002'
where location_id is null;

update shifts
set location_id = 'b2c3d4e5-0002-0002-0002-000000000002'
where location_id is null;

update recipes
set location_id = 'b2c3d4e5-0002-0002-0002-000000000002'
where location_id is null;

update recipe_groups
set location_id = 'b2c3d4e5-0002-0002-0002-000000000002'
where location_id is null;

update menu_items
set location_id = 'b2c3d4e5-0002-0002-0002-000000000002'
where location_id is null;

update menu_categories
set location_id = 'b2c3d4e5-0002-0002-0002-000000000002'
where location_id is null;

update ingredients
set location_id = 'b2c3d4e5-0002-0002-0002-000000000002'
where location_id is null;

update invoices
set location_id = 'b2c3d4e5-0002-0002-0002-000000000002'
where location_id is null;

update business_settings
set location_id = 'b2c3d4e5-0002-0002-0002-000000000002'
where location_id is null;


-- ── STEP 6: Verification queries ────────────────────────────
-- Run each of these — every result should be 0.
-- If any return > 0, DO NOT proceed to Step 7.

select 'orders null location_id',           count(*) from orders           where location_id is null;
select 'production null location_id',       count(*) from production       where location_id is null;
select 'production_notes null',             count(*) from production_notes  where location_id is null;
select 'production_template null',          count(*) from production_template where location_id is null;
select 'waste_log null',                    count(*) from waste_log          where location_id is null;
select 'employees null',                    count(*) from employees          where location_id is null;
select 'shifts null',                       count(*) from shifts             where location_id is null;
select 'recipes null',                      count(*) from recipes            where location_id is null;
select 'recipe_groups null',                count(*) from recipe_groups      where location_id is null;
select 'menu_items null',                   count(*) from menu_items         where location_id is null;
select 'menu_categories null',              count(*) from menu_categories    where location_id is null;
select 'ingredients null',                  count(*) from ingredients        where location_id is null;
select 'invoices null',                     count(*) from invoices           where location_id is null;
select 'business_settings null',            count(*) from business_settings  where location_id is null;

-- Confirm SRP org and location exist:
select 'org count', count(*) from organizations where id = 'a1b2c3d4-0001-0001-0001-000000000001';
select 'loc count', count(*) from locations     where id = 'b2c3d4e5-0002-0002-0002-000000000002';
select 'org_owner count', count(*) from organization_members
  where organization_id = 'a1b2c3d4-0001-0001-0001-000000000001' and role = 'org_owner';


-- ── STEP 7: Add NOT NULL constraints ────────────────────────
-- ONLY run this section after Step 6 confirms all counts are 0.
-- Comment out or remove after running successfully.

/*
alter table orders              alter column location_id set not null;
alter table production          alter column location_id set not null;
alter table production_notes    alter column location_id set not null;
alter table production_template alter column location_id set not null;
alter table waste_log           alter column location_id set not null;
alter table employees           alter column location_id set not null;
alter table shifts              alter column location_id set not null;
alter table recipes             alter column location_id set not null;
alter table recipe_groups       alter column location_id set not null;
alter table menu_items          alter column location_id set not null;
alter table menu_categories     alter column location_id set not null;
alter table ingredients         alter column location_id set not null;
alter table invoices            alter column location_id set not null;
*/


-- ── STEP 8: Remove migration-period null bypass ──────────────
-- After NOT NULL constraints are in place and verified, update the access
-- functions to remove the "loc_id IS NULL" escape hatch:
--
-- create or replace function user_can_access_location(loc_id uuid)
-- returns boolean language sql stable security definer as $$
--   select
--     exists (select 1 from organization_members om join locations l on l.organization_id = om.organization_id
--             where om.user_id = auth.uid() and l.id = loc_id)
--     or
--     exists (select 1 from location_members lm where lm.user_id = auth.uid() and lm.location_id = loc_id);
-- $$;
--
-- (Same pattern for user_is_admin_for_location.)
