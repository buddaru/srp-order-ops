-- Fix recipe_groups: groups are org-wide, not per-location.
-- The multitenant migration wrongly scoped them to a single location,
-- which caused ensureGroup() in the Meez sync to fail (location_id NOT NULL)
-- and the frontend to show no groups for the corp/multi-location account.

-- 1. Make location_id nullable again — groups are shared across all locations
alter table recipe_groups alter column location_id drop not null;

-- 2. Revert RLS to allow any authenticated user to see/manage all groups
drop policy if exists "Location-scoped recipe groups" on recipe_groups;

create policy "Authenticated users can manage recipe groups"
  on recipe_groups for all to authenticated
  using (true)
  with check (true);
