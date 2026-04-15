-- ============================================================
-- CADRO — Invoices & Price History Migration
-- Run in Supabase → SQL Editor
-- Safe to re-run (uses IF NOT EXISTS)
-- ============================================================

-- ── 1. INVOICES ─────────────────────────────────────────────
create table if not exists invoices (
  id             uuid primary key default gen_random_uuid(),
  invoice_number text,
  supplier       text,
  order_date     date,
  delivery_date  date,
  total_amount   numeric,
  item_count     integer default 0,
  line_items     jsonb default '[]'::jsonb,
  matches        jsonb default '[]'::jsonb,
  created_at     timestamptz default now()
);

alter table invoices enable row level security;

drop policy if exists "Authenticated users can manage invoices" on invoices;
create policy "Authenticated users can manage invoices"
  on invoices for all to authenticated using (true) with check (true);

-- ── 2. INGREDIENT PRICE HISTORY ─────────────────────────────
create table if not exists ingredient_price_history (
  id              uuid primary key default gen_random_uuid(),
  ingredient_id   uuid references ingredients(id) on delete cascade,
  ingredient_name text,
  purchase_price  numeric not null,
  purchase_unit   text,
  supplier        text,
  source          text default 'manual',  -- 'manual' | 'invoice'
  invoice_id      uuid references invoices(id) on delete set null,
  invoice_number  text,
  recorded_at     timestamptz default now()
);

alter table ingredient_price_history enable row level security;

drop policy if exists "Authenticated users can manage ingredient price history" on ingredient_price_history;
create policy "Authenticated users can manage ingredient price history"
  on ingredient_price_history for all to authenticated using (true) with check (true);

-- ── 3. INDEX for fast lookups ───────────────────────────────
create index if not exists idx_price_history_ingredient_id
  on ingredient_price_history(ingredient_id, recorded_at desc);

create index if not exists idx_invoices_order_date
  on invoices(order_date desc);
