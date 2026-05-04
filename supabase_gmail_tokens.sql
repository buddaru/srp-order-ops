-- Gmail OAuth token storage
-- Run this once in your Supabase SQL editor

create table if not exists gmail_tokens (
  id            text primary key default 'default',
  refresh_token text not null,
  updated_at    timestamptz not null default now()
);

-- Only the service role can read/write this table
alter table gmail_tokens enable row level security;

-- No public access — service role bypasses RLS anyway
create policy "no public access" on gmail_tokens
  for all using (false);

-- Seed with your current token from env (run once, then delete the env var from Vercel)
-- insert into gmail_tokens (id, refresh_token) values ('default', 'YOUR_REFRESH_TOKEN_HERE')
-- on conflict (id) do update set refresh_token = excluded.refresh_token, updated_at = now();
