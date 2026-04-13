-- Run this in Supabase → SQL Editor
-- Creates the business_settings table (single-row config)

create table if not exists business_settings (
  id              integer primary key default 1,
  business_name   text not null default 'Sweet Red Peach',
  city            text not null default 'Carson',
  sms_ready       text not null default '🎉 Your {business} order is READY, {name}! Come pick up anytime — we''ll have it waiting.',
  sms_pickup      text not null default 'Thanks for visiting {business}, {name}! We hope you love every bite. See you next time!',
  updated_at      timestamptz default now(),
  -- Enforce single-row constraint
  constraint single_row check (id = 1)
);

-- Enable RLS
alter table business_settings enable row level security;

-- Authenticated users can read (needed for SMS templates)
create policy "Authenticated users can read business settings"
  on business_settings for select
  to authenticated
  using (true);

-- Only admins can update
create policy "Admins can update business settings"
  on business_settings for all
  to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Seed the default row
insert into business_settings (id, business_name, city)
values (1, 'Sweet Red Peach', 'Carson')
on conflict (id) do nothing;
