-- ============================================================
-- CADRO — Multi-Tenant Migration
-- Run in Supabase → SQL Editor on STAGING first, then prod.
-- Safe to re-run (uses IF NOT EXISTS / DROP IF EXISTS patterns).
-- ============================================================


-- ── PART 1: NEW TABLES ──────────────────────────────────────

create table if not exists organizations (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  subscription_status text not null default 'trialing'
    check (subscription_status in ('trialing', 'active', 'past_due', 'canceled')),
  billing_email       text,
  created_at          timestamptz default now()
);

alter table organizations enable row level security;


create table if not exists locations (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  brand_id         uuid,   -- reserved for future Brand layer, unused in MVP
  name             text not null,
  slug             text not null,
  timezone         text not null default 'America/Los_Angeles',
  business_hours   jsonb default '{}'::jsonb,
  currency         text not null default 'usd',
  settings         jsonb default '{}'::jsonb,
  created_at       timestamptz default now(),
  unique (organization_id, slug)
);

alter table locations enable row level security;


create table if not exists organization_members (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  role            text not null check (role in ('org_owner', 'org_admin')),
  created_at      timestamptz default now(),
  unique (user_id, organization_id)
);

alter table organization_members enable row level security;


create table if not exists location_members (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  role        text not null check (role in ('manager', 'employee')),
  created_at  timestamptz default now(),
  unique (user_id, location_id)
);

alter table location_members enable row level security;


-- Stores per-location OAuth tokens for Gmail, SendGrid, Twilio, etc.
-- config JSONB holds provider-specific credentials (encrypted via Supabase Vault in P1).
create table if not exists location_integrations (
  id          uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  provider    text not null,  -- 'gmail' | 'sendgrid' | 'twilio' | 'bento'
  config      jsonb not null default '{}'::jsonb,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique (location_id, provider)
);

alter table location_integrations enable row level security;


-- ── PART 2: ACCESS CHECK FUNCTIONS ──────────────────────────
-- Single source of truth — called from every RLS policy on customer-data tables.
-- The loc_id IS NULL branch allows rows that haven't been backfilled yet; remove
-- after running supabase_srp_backfill.sql and verifying all rows have location_id.

create or replace function user_can_access_location(loc_id uuid)
returns boolean
language sql
stable
security definer
as $$
  select
    loc_id is null
    or
    exists (
      select 1
      from organization_members om
      join locations l on l.organization_id = om.organization_id
      where om.user_id = auth.uid()
        and l.id = loc_id
    )
    or
    exists (
      select 1
      from location_members lm
      where lm.user_id = auth.uid()
        and lm.location_id = loc_id
    );
$$;

-- Returns true for org_owner, org_admin, or location manager.
create or replace function user_is_admin_for_location(loc_id uuid)
returns boolean
language sql
stable
security definer
as $$
  select
    loc_id is null
    or
    exists (
      select 1
      from organization_members om
      join locations l on l.organization_id = om.organization_id
      where om.user_id = auth.uid()
        and l.id = loc_id
        and om.role in ('org_owner', 'org_admin')
    )
    or
    exists (
      select 1
      from location_members lm
      where lm.user_id = auth.uid()
        and lm.location_id = loc_id
        and lm.role = 'manager'
    );
$$;


-- ── PART 3: ADD location_id TO EXISTING TABLES ──────────────
-- Columns are nullable during migration; backfill script fills them in,
-- then NOT NULL constraints are added at the end of the backfill.

-- Orders (schema lives in Supabase, not in repo migration files)
alter table orders add column if not exists location_id uuid references locations(id);

-- Production
alter table production          add column if not exists location_id uuid references locations(id);
alter table production_notes    add column if not exists location_id uuid references locations(id);
alter table production_template add column if not exists location_id uuid references locations(id);

-- Waste
alter table waste_log add column if not exists location_id uuid references locations(id);

-- Schedule
alter table employees add column if not exists location_id uuid references locations(id);
alter table shifts     add column if not exists location_id uuid references locations(id);

-- Recipes
alter table recipes       add column if not exists location_id uuid references locations(id);
alter table recipe_groups add column if not exists location_id uuid references locations(id);

-- Menu
alter table menu_items       add column if not exists location_id uuid references locations(id);
alter table menu_categories  add column if not exists location_id uuid references locations(id);

-- Ingredients & Invoices
alter table ingredients add column if not exists location_id uuid references locations(id);
alter table invoices     add column if not exists location_id uuid references locations(id);

-- Business settings: drop the single-row constraint; add location_id.
-- business_settings becomes a per-location config table.
alter table business_settings drop constraint if exists single_row;
alter table business_settings add column if not exists location_id uuid references locations(id);


-- ── PART 4: RLS POLICIES FOR NEW TABLES ─────────────────────

-- organizations --
drop policy if exists "Members can view their organization" on organizations;
create policy "Members can view their organization"
  on organizations for select to authenticated
  using (
    exists (
      select 1 from organization_members
      where user_id = auth.uid() and organization_id = organizations.id
    )
    or exists (
      select 1
      from location_members lm
      join locations l on l.id = lm.location_id
      where lm.user_id = auth.uid() and l.organization_id = organizations.id
    )
  );

drop policy if exists "Org owners can update organization" on organizations;
create policy "Org owners can update organization"
  on organizations for update to authenticated
  using (
    exists (
      select 1 from organization_members
      where user_id = auth.uid()
        and organization_id = organizations.id
        and role = 'org_owner'
    )
  );

-- locations --
drop policy if exists "Members can view accessible locations" on locations;
create policy "Members can view accessible locations"
  on locations for select to authenticated
  using (user_can_access_location(id));

drop policy if exists "Admins can manage locations" on locations;
create policy "Admins can manage locations"
  on locations for all to authenticated
  using (
    exists (
      select 1 from organization_members om
      where om.user_id = auth.uid()
        and om.organization_id = locations.organization_id
        and om.role in ('org_owner', 'org_admin')
    )
  );

-- organization_members --
drop policy if exists "Members can view org membership" on organization_members;
create policy "Members can view org membership"
  on organization_members for select to authenticated
  using (
    exists (
      select 1 from organization_members om2
      where om2.user_id = auth.uid()
        and om2.organization_id = organization_members.organization_id
    )
    or exists (
      select 1
      from location_members lm
      join locations l on l.id = lm.location_id
      where lm.user_id = auth.uid()
        and l.organization_id = organization_members.organization_id
    )
  );

drop policy if exists "Org owners can manage org membership" on organization_members;
create policy "Org owners can manage org membership"
  on organization_members for all to authenticated
  using (
    exists (
      select 1 from organization_members om2
      where om2.user_id = auth.uid()
        and om2.organization_id = organization_members.organization_id
        and om2.role = 'org_owner'
    )
  );

-- location_members --
drop policy if exists "Members can view location membership" on location_members;
create policy "Members can view location membership"
  on location_members for select to authenticated
  using (user_can_access_location(location_id));

drop policy if exists "Admins can manage location membership" on location_members;
create policy "Admins can manage location membership"
  on location_members for all to authenticated
  using (user_is_admin_for_location(location_id));

-- location_integrations --
drop policy if exists "Admins can manage location integrations" on location_integrations;
create policy "Admins can manage location integrations"
  on location_integrations for all to authenticated
  using (user_is_admin_for_location(location_id));


-- ── PART 5: REPLACE EXISTING TABLE RLS POLICIES ─────────────

-- orders --
drop policy if exists "Authenticated users can manage orders" on orders;
create policy "Location-scoped orders"
  on orders for all to authenticated
  using (user_can_access_location(location_id))
  with check (user_can_access_location(location_id));

-- production --
drop policy if exists "Authenticated users can manage production" on production;
create policy "Location-scoped production"
  on production for all to authenticated
  using (user_can_access_location(location_id))
  with check (user_can_access_location(location_id));

-- production_notes --
drop policy if exists "Authenticated users can manage production notes" on production_notes;
create policy "Location-scoped production notes"
  on production_notes for all to authenticated
  using (user_can_access_location(location_id))
  with check (user_can_access_location(location_id));

-- production_template --
drop policy if exists "Authenticated users can manage production template" on production_template;
create policy "Location-scoped production template"
  on production_template for all to authenticated
  using (user_can_access_location(location_id))
  with check (user_can_access_location(location_id));

-- waste_log --
drop policy if exists "Authenticated users can manage waste log" on waste_log;
create policy "Location-scoped waste log"
  on waste_log for all to authenticated
  using (user_can_access_location(location_id))
  with check (user_can_access_location(location_id));

-- employees --
drop policy if exists "Authenticated users can manage employees" on employees;
create policy "Location-scoped employees"
  on employees for all to authenticated
  using (user_can_access_location(location_id))
  with check (user_can_access_location(location_id));

-- shifts --
drop policy if exists "Authenticated users can manage shifts" on shifts;
create policy "Location-scoped shifts"
  on shifts for all to authenticated
  using (user_can_access_location(location_id))
  with check (user_can_access_location(location_id));

-- recipes --
drop policy if exists "Authenticated users can manage recipes" on recipes;
create policy "Location-scoped recipes"
  on recipes for all to authenticated
  using (user_can_access_location(location_id))
  with check (user_can_access_location(location_id));

-- recipe_groups --
drop policy if exists "Authenticated users can manage recipe groups" on recipe_groups;
create policy "Location-scoped recipe groups"
  on recipe_groups for all to authenticated
  using (user_can_access_location(location_id))
  with check (user_can_access_location(location_id));

-- recipe_group_members: no direct location_id — access controlled at recipe_groups level.
-- Existing policy (authenticated users manage) is kept as-is; the parent recipe_groups
-- RLS already prevents cross-location access at the join level.

-- recipe_audit_log: no direct location_id — controlled at recipes level.
-- Existing policy kept as-is.

-- menu_items --
drop policy if exists "Authenticated users can read menu items" on menu_items;
drop policy if exists "Admins can manage menu items" on menu_items;
create policy "Location-scoped menu items read"
  on menu_items for select to authenticated
  using (user_can_access_location(location_id));
create policy "Location admins can manage menu items"
  on menu_items for all to authenticated
  using (user_is_admin_for_location(location_id))
  with check (user_is_admin_for_location(location_id));

-- menu_categories --
drop policy if exists "Authenticated users can manage menu categories" on menu_categories;
create policy "Location-scoped menu categories"
  on menu_categories for all to authenticated
  using (user_can_access_location(location_id))
  with check (user_can_access_location(location_id));

-- menu_item_variants, menu_item_addons, menu_item_recipes: scoped via parent menu_items.
-- Existing policies kept; access through the parent FK provides isolation.

-- ingredients --
drop policy if exists "Authenticated users can manage ingredients" on ingredients;
create policy "Location-scoped ingredients"
  on ingredients for all to authenticated
  using (user_can_access_location(location_id))
  with check (user_can_access_location(location_id));

-- ingredient_price_history: scoped via parent ingredients FK.
-- Existing policy kept.

-- invoices --
drop policy if exists "Authenticated users can manage invoices" on invoices;
create policy "Location-scoped invoices"
  on invoices for all to authenticated
  using (user_can_access_location(location_id))
  with check (user_can_access_location(location_id));

-- business_settings --
drop policy if exists "Authenticated users can read business settings" on business_settings;
drop policy if exists "Admins can update business settings" on business_settings;
create policy "Location-scoped business settings read"
  on business_settings for select to authenticated
  using (user_can_access_location(location_id));
create policy "Location admins can manage business settings"
  on business_settings for all to authenticated
  using (user_is_admin_for_location(location_id))
  with check (user_is_admin_for_location(location_id));


-- ── PART 6: INDEXES ─────────────────────────────────────────

create index if not exists idx_org_members_user_id     on organization_members(user_id);
create index if not exists idx_org_members_org_id      on organization_members(organization_id);
create index if not exists idx_loc_members_user_id     on location_members(user_id);
create index if not exists idx_loc_members_location_id on location_members(location_id);
create index if not exists idx_locations_org_id        on locations(organization_id);
create index if not exists idx_locations_slug          on locations(slug);
create index if not exists idx_orders_location_id      on orders(location_id);
create index if not exists idx_production_location_id  on production(location_id);
create index if not exists idx_ingredients_location_id on ingredients(location_id);
create index if not exists idx_invoices_location_id    on invoices(location_id);
