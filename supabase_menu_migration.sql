-- Run this once in Supabase → SQL Editor
-- Creates the menu_items table for dynamic menu management

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

-- Enable RLS
alter table menu_items enable row level security;

-- Any logged-in user can read menu items (needed for order creation)
create policy "Authenticated users can read menu items"
  on menu_items for select
  to authenticated
  using (true);

-- Only admins can insert, update, delete
create policy "Admins can manage menu items"
  on menu_items for all
  to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );
