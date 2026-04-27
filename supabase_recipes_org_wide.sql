-- Make recipes org-wide (identical across all locations).
-- Previously recipes were scoped per-location, causing discrepancies
-- in last_viewed, edits, etc. between locations in the same org.

-- 1. Deduplicate: for each meez_id keep only the most recently synced row
delete from recipe_group_members
where recipe_id in (
  select id from recipes
  where meez_id is not null
    and id not in (
      select distinct on (meez_id) id
      from recipes
      where meez_id is not null
      order by meez_id, synced_at desc nulls last
    )
);

delete from recipes
where meez_id is not null
  and id not in (
    select distinct on (meez_id) id
    from recipes
    where meez_id is not null
    order by meez_id, synced_at desc nulls last
  );

-- 2. Clear location_id on all meez-synced recipes (now org-wide)
update recipes set location_id = null where meez_id is not null;

-- 3. Make location_id nullable (org-wide recipes have no location)
alter table recipes alter column location_id drop not null;

-- 4. Revert RLS to allow any authenticated user to see all recipes
--    (user_can_access_location already returns true for loc_id IS NULL)
drop policy if exists "Location-scoped recipes" on recipes;

create policy "Authenticated users can manage recipes"
  on recipes for all to authenticated
  using (true)
  with check (true);
