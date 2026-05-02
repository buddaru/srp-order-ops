-- ─────────────────────────────────────────────────────────────
-- AUDIT CHECKLIST — run each block in Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────

-- ── ITEM 1: Check for rows missing location_id ────────────────
-- Run each query. Every result should return 0.
-- If any return > 0, do NOT remove the id=1 fallback in BusinessContext.jsx yet.

SELECT COUNT(*) AS orders_missing_location       FROM orders           WHERE location_id IS NULL;
SELECT COUNT(*) AS business_settings_missing     FROM business_settings WHERE location_id IS NULL;
SELECT COUNT(*) AS waste_missing_location        FROM waste_logs        WHERE location_id IS NULL;
SELECT COUNT(*) AS production_missing_location   FROM production_logs   WHERE location_id IS NULL;

-- Once ALL of the above return 0, it is safe to remove the fallback in:
--   src/context/BusinessContext.jsx  lines 26-28 and 46-50


-- ── ITEM 2: Verify RLS is enabled on every table ─────────────
-- This query lists every table in the public schema and whether RLS is on.
-- Every row should show  relrowsecurity = true.
-- Any table with false needs: ALTER TABLE <name> ENABLE ROW LEVEL SECURITY;

SELECT
  relname   AS table_name,
  relrowsecurity AS rls_enabled
FROM pg_class
JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
WHERE pg_namespace.nspname = 'public'
  AND relkind = 'r'
ORDER BY relname;


-- ── ITEM 2b: List all existing RLS policies ──────────────────
-- Check that every table that needs protection has at least one policy.

SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;


-- ── ITEM 11: Soft delete migration ───────────────────────────
-- Run this ONCE to add the deleted_at column.
-- After running, deploy the updated LocationApp.jsx (already updated in this PR).

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Optional: index for performance (queries filter WHERE deleted_at IS NULL)
CREATE INDEX IF NOT EXISTS orders_deleted_at_idx ON orders (deleted_at)
  WHERE deleted_at IS NULL;
